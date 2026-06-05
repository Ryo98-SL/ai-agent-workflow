import { useCallback, useRef, useState } from "react";
import { RunSseEventSchema, type CreateRunRequest } from "@ai-agent-workflow/api-contracts";
import type { DebugState, NodeExecutionState, WorkbenchWorkflowApi } from "../types";

export function useWorkflowExecution(workflowApi: WorkbenchWorkflowApi) {
  const [nodeStates, setNodeStates] = useState<Map<string, NodeExecutionState>>(() => new Map());
  const [debugState, setDebugState] = useState<DebugState>({ status: "idle" });
  const eventSourceRef = useRef<EventSource | null>(null);
  // Once a run reaches a terminal state, ignore further stream events — a closed
  // SSE stream can still fire a reconnect/onerror that would clobber the result.
  const finishedRef = useRef(false);

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
        .createRun(workflowId, request)
        .then(({ run }) => {
          const source = new EventSource(workflowApi.runStreamUrl(run.id));
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
            } else if (sseEvent.type === "run.completed") {
              finishedRef.current = true;
              source.close();
              eventSourceRef.current = null;
              const runStatus = sseEvent.status;
              Promise.all([workflowApi.getRun(run.id), workflowApi.listRunEvents(run.id)])
                .then(([runRes, eventsRes]) => {
                  setDebugState({
                    status: runStatus === "failed" ? "error" : "success",
                    result: { run: runRes.run, events: eventsRes.events },
                  });
                })
                .catch(() => {
                  setDebugState({ status: runStatus === "failed" ? "error" : "success", result: { run, events: [] } });
                });
            }
          };

          source.onerror = () => {
            // The stream closes normally after run.completed; don't treat that as
            // an error or overwrite the final result.
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
        })
        .catch((err: unknown) => {
          setDebugState({ status: "error", error: err instanceof Error ? err.message : "Run creation failed." });
        });
    },
    [workflowApi],
  );

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  return { nodeStates, debugState, setDebugState, runWorkflow, cleanup };
}
