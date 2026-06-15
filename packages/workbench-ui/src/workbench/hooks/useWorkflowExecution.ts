import { useCallback, useEffect, useRef, useState } from "react";
import { RunSseEventSchema, type CreateRunRequest, type ResumeRunRequest } from "@ai-agent-workflow/api-contracts";
import type { ChatTurn, DebugState, NodeExecutionState, WorkbenchWorkflowApi } from "../types";
import { reduceRunNodeStreamEvent } from "../runStreamReducer";

function newConversationId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `conv-${Date.now()}-${Math.random()}`;
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Date.now()}-${Math.random()}`;
}

/**
 * Picks the assistant reply for a Chat Mode turn from the run's node states: the
 * reached End node's resolved Answer Template, falling back to the last LLM/Agent
 * node's text (or its live streaming text). Mirrors the runtime's "answer" semantics.
 */
export function deriveChatAnswer(nodeStates: Map<string, NodeExecutionState>): string {
  const states = [...nodeStates.values()];
  const ended = states.filter((state) => state.nodeType === "end" && (state.output ?? "").trim().length > 0);
  if (ended.length > 0) {
    return ended[ended.length - 1].output ?? "";
  }
  const streaming = states.filter((state) => state.nodeType === "llm" || state.nodeType === "agent");
  const last = streaming[streaming.length - 1];
  if (!last || (last.nodeType !== "llm" && last.nodeType !== "agent")) {
    return "";
  }
  return (last.output ?? last.streamingText ?? "").trim();
}

export function useWorkflowExecution(workflowApi: WorkbenchWorkflowApi) {
  const [nodeStates, setNodeStates] = useState<Map<string, NodeExecutionState>>(() => new Map());
  const [debugState, setDebugState] = useState<DebugState>({ status: "idle" });
  const eventSourceRef = useRef<EventSource | null>(null);
  // Stable across runs so memory-enabled nodes accumulate history; reset by the
  // user via "New conversation".
  const conversationIdRef = useRef<string>(newConversationId());
  const [conversationTurns, setConversationTurns] = useState(0);
  // Chat Mode transcript. The last entry is the "live" turn while a run is active.
  const [transcript, setTranscript] = useState<ChatTurn[]>([]);
  // Mirror of `nodeStates` for synchronous reads inside SSE handlers (finalizing a
  // chat turn needs the freshest node states without waiting for a re-render).
  const nodeStatesRef = useRef<Map<string, NodeExecutionState>>(new Map());
  useEffect(() => {
    nodeStatesRef.current = nodeStates;
  }, [nodeStates]);
  // Whether the active run is a Chat Mode turn (drives transcript finalization).
  const activeChatRef = useRef(false);
  // Once a leg reaches a terminal/paused state, ignore further stream events — a
  // closed SSE stream can still fire a reconnect/onerror that would clobber it.
  const finishedRef = useRef(false);

  // Updates the live (last) chat turn, if one is active.
  const patchActiveTurn = useCallback((patch: Partial<ChatTurn>) => {
    setTranscript((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      next[next.length - 1] = { ...next[next.length - 1], ...patch };
      return next;
    });
  }, []);

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

        if (
          sseEvent.type === "node.started" ||
          sseEvent.type === "node.stream" ||
          sseEvent.type === "node.completed" ||
          sseEvent.type === "node.failed" ||
          sseEvent.type === "agent.tool"
        ) {
          setNodeStates((prev) => reduceRunNodeStreamEvent(prev, sseEvent));
        } else if (sseEvent.type === "run.waiting") {
          // Paused on a Human Input node: close this leg and surface the form.
          finishedRef.current = true;
          source.close();
          eventSourceRef.current = null;
          setDebugState({ status: "waiting", waiting: { runId, interrupt: sseEvent.interrupt } });
          if (activeChatRef.current) {
            patchActiveTurn({ status: "waiting", answer: deriveChatAnswer(nodeStatesRef.current) });
          }
        } else if (sseEvent.type === "run.completed") {
          finishedRef.current = true;
          source.close();
          eventSourceRef.current = null;
          const runStatus = sseEvent.status;
          // Snapshot node states now so this chat turn's trace survives later turns.
          const turnNodeStates = new Map(nodeStatesRef.current);
          const answer = deriveChatAnswer(turnNodeStates);
          Promise.all([workflowApi.getRun(runId), workflowApi.listRunEvents(runId)])
            .then(([runRes, eventsRes]) => {
              const result = { run: runRes.run, events: eventsRes.events };
              setDebugState({ status: runStatus === "failed" ? "error" : "success", result });
              if (activeChatRef.current) {
                patchActiveTurn({
                  status: runStatus === "failed" ? "error" : "success",
                  answer,
                  nodeStates: turnNodeStates,
                  result,
                });
              }
            })
            .catch(() => {
              setDebugState({ status: runStatus === "failed" ? "error" : "success" });
              if (activeChatRef.current) {
                patchActiveTurn({ status: runStatus === "failed" ? "error" : "success", answer, nodeStates: turnNodeStates });
              }
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
        if (activeChatRef.current) {
          patchActiveTurn({ status: "error", error: "连接中断，请重试。" });
        }
      };
    },
    [patchActiveTurn, workflowApi],
  );

  const runWorkflow = useCallback(
    (workflowId: string, request: CreateRunRequest) => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      activeChatRef.current = false;
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

  /**
   * Chat Mode: send one user message. Appends a live transcript turn, then runs the
   * workflow with `query` carried as the `{{userInput.query}}` ambient variable.
   * `baseInput` holds the once-per-conversation Start field values.
   */
  const sendChatMessage = useCallback(
    (workflowId: string, query: string, baseInput: CreateRunRequest["input"], extra: Partial<CreateRunRequest> = {}) => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      activeChatRef.current = true;
      finishedRef.current = false;
      setNodeStates(new Map());
      nodeStatesRef.current = new Map();
      setDebugState({ status: "running" });
      setTranscript((prev) => [...prev, { id: newId(), query, status: "running", answer: "" }]);

      workflowApi
        .createRun(workflowId, { ...extra, input: baseInput, query, conversationId: conversationIdRef.current })
        .then(({ run }) => {
          setConversationTurns((count) => count + 1);
          patchActiveTurn({ runId: run.id });
          subscribeToStream(run.id);
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : "Run creation failed.";
          setDebugState({ status: "error", error: message });
          patchActiveTurn({ status: "error", error: message });
        });
    },
    [patchActiveTurn, subscribeToStream, workflowApi],
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
      if (activeChatRef.current) {
        patchActiveTurn({ status: "running" });
      }

      workflowApi
        .resumeRun(runId, request)
        .then(() => {
          subscribeToStream(runId);
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : "Resume failed.";
          setDebugState({ status: "error", error: message });
          if (activeChatRef.current) {
            patchActiveTurn({ status: "error", error: message });
          }
        });
    },
    [patchActiveTurn, subscribeToStream, workflowApi],
  );

  const newConversation = useCallback(() => {
    conversationIdRef.current = newConversationId();
    setConversationTurns(0);
    setTranscript([]);
    activeChatRef.current = false;
    setNodeStates(new Map());
    setDebugState({ status: "idle" });
  }, []);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  return {
    nodeStates,
    debugState,
    setDebugState,
    runWorkflow,
    sendChatMessage,
    transcript,
    resumeRun,
    newConversation,
    conversationTurns,
    cleanup,
  };
}
