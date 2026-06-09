import { useCallback, useRef, useState } from "react";
import { RunSseEventSchema, type CreateRunRequest, type ResumeRunRequest } from "@ai-agent-workflow/api-contracts";
import type { DebugState, NodeExecutionState, WorkbenchWorkflowApi } from "../types";

function newConversationId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `conv-${Date.now()}-${Math.random()}`;
}

export function useWorkflowExecution(workflowApi: WorkbenchWorkflowApi) {
  const [nodeStates, setNodeStates] = useState<Map<string, NodeExecutionState>>(() => new Map());
  const [debugState, setDebugState] = useState<DebugState>({ status: "idle" });
  const eventSourceRef = useRef<EventSource | null>(null);
  // Stable across runs so memory-enabled nodes accumulate history; reset by the
  // user via "New conversation".
  const conversationIdRef = useRef<string>(newConversationId());
  const [conversationTurns, setConversationTurns] = useState(0);
  // Once a leg reaches a terminal/paused state, ignore further stream events — a
  // closed SSE stream can still fire a reconnect/onerror that would clobber it.
  const finishedRef = useRef(false);

  // Subscribes to a run's SSE stream and drives node + debug state. Shared by the
  // initial run and by resume (which opens a fresh stream on the same run).
  const subscribeToStream = useCallback(
    (runId: string) => {
      const source = new EventSource(workflowApi.runStreamUrl(runId));
      eventSourceRef.current = source;

      source.onmessage = (msgEvent) => {
        if (finishedRef.current) return;
        const parsed = RunSseEventSchema.safeParse(JSON.parse(String(msgEvent.data)));
        if (!parsed.success) return;
        const sseEvent = parsed.data;

        if (sseEvent.type === "node.started") {
          const { nodeId, nodeType } = sseEvent;
          setNodeStates((prev) => {
            const next = new Map(prev);
            const base = { nodeId, status: "running" as const, startedAt: Date.now() };
            if (nodeType === "llm") {
              next.set(nodeId, { ...base, nodeType: "llm", streamingText: "" });
            } else {
              next.set(nodeId, { ...base, nodeType });
            }
            return next;
          });
        } else if (sseEvent.type === "node.stream") {
          const { nodeId, delta } = sseEvent;
          setNodeStates((prev) => {
            const existing = prev.get(nodeId);
            if (!existing || existing.nodeType !== "llm") return prev;
            const next = new Map(prev);
            next.set(nodeId, { ...existing, streamingText: existing.streamingText + delta });
            return next;
          });
        } else if (sseEvent.type === "node.completed") {
          const { nodeId, output, data, durationMs, inputTokens, outputTokens } = sseEvent;
          const completedAt = Date.now();
          setNodeStates((prev) => {
            const existing = prev.get(nodeId);
            if (!existing) return prev;
            const next = new Map(prev);
            if (existing.nodeType === "llm") {
              next.set(nodeId, {
                ...existing,
                status: "succeeded",
                completedAt,
                durationMs,
                output,
                data,
                inputTokens,
                outputTokens,
              });
            } else {
              next.set(nodeId, { ...existing, status: "succeeded", completedAt, durationMs, output, data });
            }
            return next;
          });
        } else if (sseEvent.type === "node.failed") {
          const { nodeId, error, durationMs } = sseEvent;
          const completedAt = Date.now();
          setNodeStates((prev) => {
            const existing = prev.get(nodeId);
            if (!existing) return prev;
            const next = new Map(prev);
            next.set(nodeId, { ...existing, status: "failed", completedAt, durationMs, error });
            return next;
          });
        } else if (sseEvent.type === "run.waiting") {
          // Paused on a Human Input node: close this leg and surface the form.
          finishedRef.current = true;
          source.close();
          eventSourceRef.current = null;
          setDebugState({ status: "waiting", waiting: { runId, interrupt: sseEvent.interrupt } });
        } else if (sseEvent.type === "run.completed") {
          finishedRef.current = true;
          source.close();
          eventSourceRef.current = null;
          const runStatus = sseEvent.status;
          Promise.all([workflowApi.getRun(runId), workflowApi.listRunEvents(runId)])
            .then(([runRes, eventsRes]) => {
              setDebugState({
                status: runStatus === "failed" ? "error" : "success",
                result: { run: runRes.run, events: eventsRes.events },
              });
            })
            .catch(() => {
              setDebugState({ status: runStatus === "failed" ? "error" : "success" });
            });
        }
      };

      source.onerror = () => {
        // The stream closes normally after run.completed/run.waiting; don't treat
        // that as an error or overwrite the final result.
        if (finishedRef.current) {
          source.close();
          eventSourceRef.current = null;
          return;
        }
        finishedRef.current = true;
        source.close();
        eventSourceRef.current = null;
        setDebugState({ status: "error", error: "SSE connection failed." });
      };
    },
    [workflowApi],
  );

  const runWorkflow = useCallback(
    (workflowId: string, request: CreateRunRequest) => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      finishedRef.current = false;
      setNodeStates(new Map());
      setDebugState({ status: "running" });

      workflowApi
        .createRun(workflowId, { ...request, conversationId: conversationIdRef.current })
        .then(({ run }) => {
          setConversationTurns((count) => count + 1);
          subscribeToStream(run.id);
        })
        .catch((err: unknown) => {
          setDebugState({ status: "error", error: err instanceof Error ? err.message : "Run creation failed." });
        });
    },
    [subscribeToStream, workflowApi],
  );

  // Answers a paused Human Input interrupt and re-subscribes to the continuation.
  // Node states are kept so already-finished nodes stay rendered.
  const resumeRun = useCallback(
    (runId: string, request: ResumeRunRequest) => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      finishedRef.current = false;
      setDebugState({ status: "running" });

      workflowApi
        .resumeRun(runId, request)
        .then(() => {
          subscribeToStream(runId);
        })
        .catch((err: unknown) => {
          setDebugState({ status: "error", error: err instanceof Error ? err.message : "Resume failed." });
        });
    },
    [subscribeToStream, workflowApi],
  );

  const newConversation = useCallback(() => {
    conversationIdRef.current = newConversationId();
    setConversationTurns(0);
  }, []);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  return { nodeStates, debugState, setDebugState, runWorkflow, resumeRun, newConversation, conversationTurns, cleanup };
}
