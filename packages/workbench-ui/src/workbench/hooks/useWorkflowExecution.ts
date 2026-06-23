import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import { RunSseEventSchema, type CreateRunRequest, type ResumeRunRequest } from "@ai-agent-workflow/api-contracts";
import type { ChatTurn, DebugState, NodeExecutionState, WorkbenchWorkflowApi } from "../types";
import { reduceRunNodeStreamEvent } from "../runStreamReducer";

function newConversationId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `conv-${Date.now()}-${Math.random()}`;
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Date.now()}-${Math.random()}`;
}

type WorkflowExecutionSession = {
  nodeStates: Map<string, NodeExecutionState>;
  debugState: DebugState;
  conversationId: string;
  conversationTurns: number;
  transcript: ChatTurn[];
  activeChat: boolean;
};

type WorkflowExecutionOptions = {
  onRunError?: (error: unknown) => void;
};

function cloneTranscript(transcript: ChatTurn[]): ChatTurn[] {
  return transcript.map((turn) => ({
    ...turn,
    nodeStates: turn.nodeStates ? new Map(turn.nodeStates) : undefined,
  }));
}

function createEmptySession(): WorkflowExecutionSession {
  return {
    nodeStates: new Map(),
    debugState: { status: "idle" },
    conversationId: newConversationId(),
    conversationTurns: 0,
    transcript: [],
    activeChat: false,
  };
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

export function useWorkflowExecution(workflowApi: WorkbenchWorkflowApi, options: WorkflowExecutionOptions = {}) {
  const { onRunError } = options;
  const [nodeStates, setNodeStates] = useState<Map<string, NodeExecutionState>>(() => new Map());
  const [debugState, setDebugState] = useState<DebugState>({ status: "idle" });
  const [conversationTurns, setConversationTurns] = useState(0);
  // Chat Mode transcript. The last entry is the "live" turn while a run is active.
  const [transcript, setTranscript] = useState<ChatTurn[]>([]);
  const nodeStatesRef = useRef<Map<string, NodeExecutionState>>(new Map());
  const debugStateRef = useRef<DebugState>({ status: "idle" });
  const conversationTurnsRef = useRef(0);
  const transcriptRef = useRef<ChatTurn[]>([]);
  const eventSourceRefs = useRef<Map<string, EventSource>>(new Map());
  // Stable across runs so memory-enabled nodes accumulate history; reset by the
  // user via "New conversation".
  const conversationIdRef = useRef<string>(newConversationId());
  // Mirror of `nodeStates` for synchronous reads inside SSE handlers (finalizing a
  // chat turn needs the freshest node states without waiting for a re-render).
  const sessionsRef = useRef<Map<string, WorkflowExecutionSession>>(new Map());
  const activeSessionKeyRef = useRef<string | null>(null);
  useEffect(() => {
    nodeStatesRef.current = nodeStates;
  }, [nodeStates]);
  useEffect(() => {
    debugStateRef.current = debugState;
  }, [debugState]);
  useEffect(() => {
    conversationTurnsRef.current = conversationTurns;
  }, [conversationTurns]);
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);
  // Whether the active run is a Chat Mode turn (drives transcript finalization).
  const activeChatRef = useRef(false);
  // Once a leg reaches a terminal/paused state, ignore further stream events — a
  // closed SSE stream can still fire a reconnect/onerror that would clobber it.
  const finishedBySessionRef = useRef<Map<string, boolean>>(new Map());

  const setNodeStatesAndRef = useCallback((next: SetStateAction<Map<string, NodeExecutionState>>) => {
    setNodeStates((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      nodeStatesRef.current = resolved;
      const key = activeSessionKeyRef.current;
      if (key) {
        const current = sessionsRef.current.get(key) ?? createEmptySession();
        sessionsRef.current.set(key, { ...current, nodeStates: resolved });
      }
      return resolved;
    });
  }, []);

  const setDebugStateAndRef = useCallback((next: SetStateAction<DebugState>) => {
    setDebugState((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      debugStateRef.current = resolved;
      const key = activeSessionKeyRef.current;
      if (key) {
        const current = sessionsRef.current.get(key) ?? createEmptySession();
        sessionsRef.current.set(key, { ...current, debugState: resolved });
      }
      return resolved;
    });
  }, []);

  const setConversationTurnsAndRef = useCallback((next: SetStateAction<number>) => {
    setConversationTurns((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      conversationTurnsRef.current = resolved;
      const key = activeSessionKeyRef.current;
      if (key) {
        const current = sessionsRef.current.get(key) ?? createEmptySession();
        sessionsRef.current.set(key, { ...current, conversationTurns: resolved });
      }
      return resolved;
    });
  }, []);

  const setTranscriptAndRef = useCallback((next: SetStateAction<ChatTurn[]>) => {
    setTranscript((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      transcriptRef.current = resolved;
      const key = activeSessionKeyRef.current;
      if (key) {
        const current = sessionsRef.current.get(key) ?? createEmptySession();
        sessionsRef.current.set(key, { ...current, transcript: cloneTranscript(resolved) });
      }
      return resolved;
    });
  }, []);

  const closeSessionStream = useCallback((sessionKey: string) => {
    const source = eventSourceRefs.current.get(sessionKey);
    if (source) {
      source.close();
      eventSourceRefs.current.delete(sessionKey);
    }
    finishedBySessionRef.current.set(sessionKey, true);
  }, []);

  const snapshotCurrentSession = useCallback(
    (): WorkflowExecutionSession => ({
      nodeStates: new Map(nodeStatesRef.current),
      debugState: debugStateRef.current,
      conversationId: conversationIdRef.current,
      conversationTurns: conversationTurnsRef.current,
      transcript: cloneTranscript(transcriptRef.current),
      activeChat: activeChatRef.current,
    }),
    [],
  );

  const persistActiveSession = useCallback(() => {
    const key = activeSessionKeyRef.current;
    if (!key) return;
    sessionsRef.current.set(key, snapshotCurrentSession());
  }, [snapshotCurrentSession]);

  const renderSession = useCallback((session: WorkflowExecutionSession) => {
    const nextNodeStates = new Map(session.nodeStates);
    const nextTranscript = cloneTranscript(session.transcript);
    nodeStatesRef.current = nextNodeStates;
    debugStateRef.current = session.debugState;
    conversationIdRef.current = session.conversationId;
    conversationTurnsRef.current = session.conversationTurns;
    transcriptRef.current = nextTranscript;
    activeChatRef.current = session.activeChat;
    setNodeStates(nextNodeStates);
    setDebugState(session.debugState);
    setConversationTurns(session.conversationTurns);
    setTranscript(nextTranscript);
  }, []);

  const readSession = useCallback(
    (sessionKey: string): WorkflowExecutionSession => {
      if (activeSessionKeyRef.current === sessionKey) {
        return snapshotCurrentSession();
      }
      return sessionsRef.current.get(sessionKey) ?? createEmptySession();
    },
    [snapshotCurrentSession],
  );

  const updateSession = useCallback(
    (sessionKey: string, updater: (session: WorkflowExecutionSession) => WorkflowExecutionSession) => {
      const next = updater(readSession(sessionKey));
      sessionsRef.current.set(sessionKey, {
        ...next,
        nodeStates: new Map(next.nodeStates),
        transcript: cloneTranscript(next.transcript),
      });
      if (activeSessionKeyRef.current === sessionKey) {
        renderSession(next);
      }
    },
    [readSession, renderSession],
  );

  const restoreSession = useCallback(
    (session: WorkflowExecutionSession) => {
      renderSession(session);
    },
    [renderSession],
  );

  const activateWorkflowSession = useCallback(
    (sessionKey: string) => {
      if (activeSessionKeyRef.current === sessionKey) return;
      persistActiveSession();
      const session = sessionsRef.current.get(sessionKey) ?? createEmptySession();
      activeSessionKeyRef.current = sessionKey;
      sessionsRef.current.set(sessionKey, session);
      restoreSession(session);
    },
    [persistActiveSession, restoreSession],
  );

  const resetWorkflowSession = useCallback(
    (sessionKey: string) => {
      closeSessionStream(sessionKey);
      const session = createEmptySession();
      sessionsRef.current.set(sessionKey, session);
      if (activeSessionKeyRef.current === sessionKey) {
        restoreSession(session);
      }
    },
    [closeSessionStream, restoreSession],
  );

  const prepareWorkflowSessionSwitch = useCallback(() => {
    persistActiveSession();
    activeSessionKeyRef.current = null;
  }, [persistActiveSession]);

  const moveActiveWorkflowSession = useCallback((sessionKey: string) => {
    const currentKey = activeSessionKeyRef.current;
    const snapshot = snapshotCurrentSession();
    if (currentKey && currentKey !== sessionKey) {
      sessionsRef.current.delete(currentKey);
    }
    sessionsRef.current.set(sessionKey, snapshot);
    activeSessionKeyRef.current = sessionKey;
  }, [snapshotCurrentSession]);

  // Updates the live (last) chat turn, if one is active.
  const patchActiveTurn = useCallback(
    (sessionKey: string, patch: Partial<ChatTurn>) => {
      updateSession(sessionKey, (session) => {
        if (session.transcript.length === 0) return session;
        const transcript = cloneTranscript(session.transcript);
        transcript[transcript.length - 1] = { ...transcript[transcript.length - 1], ...patch };
        return { ...session, transcript };
      });
    },
    [updateSession],
  );

  // Subscribes to a run's SSE stream and drives node + debug state. Shared by the
  // initial run and by resume (which opens a fresh stream on the same run).
  const subscribeToStream = useCallback(
    (sessionKey: string, runId: string) => {
      closeSessionStream(sessionKey);
      finishedBySessionRef.current.set(sessionKey, false);
      const source = new EventSource(workflowApi.runStreamUrl(runId));
      eventSourceRefs.current.set(sessionKey, source);

      source.onmessage = (msgEvent) => {
        if (finishedBySessionRef.current.get(sessionKey)) return;
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
          updateSession(sessionKey, (session) => ({
            ...session,
            nodeStates: reduceRunNodeStreamEvent(session.nodeStates, sseEvent),
          }));
        } else if (sseEvent.type === "run.waiting") {
          // Paused on a Human Input node: close this leg and surface the form.
          finishedBySessionRef.current.set(sessionKey, true);
          source.close();
          eventSourceRefs.current.delete(sessionKey);
          const session = readSession(sessionKey);
          updateSession(sessionKey, () => ({
            ...session,
            debugState: { status: "waiting", waiting: { runId, interrupt: sseEvent.interrupt } },
          }));
          if (session.activeChat) {
            patchActiveTurn(sessionKey, { status: "waiting", answer: deriveChatAnswer(session.nodeStates) });
          }
        } else if (sseEvent.type === "run.completed") {
          finishedBySessionRef.current.set(sessionKey, true);
          source.close();
          eventSourceRefs.current.delete(sessionKey);
          const runStatus = sseEvent.status;
          // Snapshot node states now so this chat turn's trace survives later turns.
          const session = readSession(sessionKey);
          const turnNodeStates = new Map(session.nodeStates);
          const answer = deriveChatAnswer(turnNodeStates);
          Promise.all([workflowApi.getRun(runId), workflowApi.listRunEvents(runId)])
            .then(([runRes, eventsRes]) => {
              if (runRes.run.error) {
                onRunError?.(runRes.run.error);
              }
              const result = { run: runRes.run, events: eventsRes.events };
              updateSession(sessionKey, (current) => {
                const nextStatus = runStatus === "failed" ? "error" : "success";
                const next = { ...current, debugState: { status: nextStatus, result } as DebugState };
                if (!current.activeChat || current.transcript.length === 0) return next;
                const transcript = cloneTranscript(current.transcript);
                transcript[transcript.length - 1] = {
                  ...transcript[transcript.length - 1],
                  status: nextStatus,
                  answer,
                  nodeStates: turnNodeStates,
                  result,
                };
                return { ...next, transcript };
              });
            })
            .catch(() => {
              updateSession(sessionKey, (current) => {
                const nextStatus = runStatus === "failed" ? "error" : "success";
                const next = { ...current, debugState: { status: nextStatus } as DebugState };
                if (!current.activeChat || current.transcript.length === 0) return next;
                const transcript = cloneTranscript(current.transcript);
                transcript[transcript.length - 1] = {
                  ...transcript[transcript.length - 1],
                  status: nextStatus,
                  answer,
                  nodeStates: turnNodeStates,
                };
                return { ...next, transcript };
              });
            });
        }
      };

      source.onerror = () => {
        // The stream closes normally after run.completed/run.waiting; don't treat
        // that as an error or overwrite the final result.
        if (finishedBySessionRef.current.get(sessionKey)) {
          source.close();
          eventSourceRefs.current.delete(sessionKey);
          return;
        }
        finishedBySessionRef.current.set(sessionKey, true);
        source.close();
        eventSourceRefs.current.delete(sessionKey);
        const session = readSession(sessionKey);
        updateSession(sessionKey, () => ({
          ...session,
          debugState: { status: "error", error: "SSE connection failed." },
        }));
        if (session.activeChat) {
          patchActiveTurn(sessionKey, { status: "error", error: "连接中断，请重试。" });
        }
      };
    },
    [closeSessionStream, patchActiveTurn, readSession, updateSession, workflowApi],
  );

  const runWorkflow = useCallback(
    (workflowId: string, request: CreateRunRequest) => {
      const sessionKey = activeSessionKeyRef.current ?? workflowId;
      closeSessionStream(sessionKey);
      const session = readSession(sessionKey);
      updateSession(sessionKey, () => ({
        ...session,
        activeChat: false,
        nodeStates: new Map(),
        debugState: { status: "running" },
      }));

      workflowApi
        .createRun(workflowId, { ...request, conversationId: session.conversationId })
        .then(({ run }) => {
          updateSession(sessionKey, (current) => ({
            ...current,
            conversationTurns: current.conversationTurns + 1,
          }));
          subscribeToStream(sessionKey, run.id);
        })
        .catch((err: unknown) => {
          onRunError?.(err);
          updateSession(sessionKey, (current) => ({
            ...current,
            debugState: { status: "error", error: err instanceof Error ? err.message : "Run creation failed." },
          }));
        });
    },
    [closeSessionStream, onRunError, readSession, subscribeToStream, updateSession, workflowApi],
  );

  /**
   * Chat Mode: send one user message. Appends a live transcript turn, then runs the
   * workflow with `query` carried as the `{{userInput.query}}` ambient variable.
   * `baseInput` holds the once-per-conversation Start field values.
   */
  const sendChatMessage = useCallback(
    (workflowId: string, query: string, baseInput: CreateRunRequest["input"], extra: Partial<CreateRunRequest> = {}) => {
      const sessionKey = activeSessionKeyRef.current ?? workflowId;
      closeSessionStream(sessionKey);
      const session = readSession(sessionKey);
      updateSession(sessionKey, () => ({
        ...session,
        activeChat: true,
        nodeStates: new Map(),
        debugState: { status: "running" },
        transcript: [...cloneTranscript(session.transcript), { id: newId(), query, status: "running", answer: "" }],
      }));

      workflowApi
        .createRun(workflowId, { ...extra, input: baseInput, query, conversationId: session.conversationId })
        .then(({ run }) => {
          updateSession(sessionKey, (current) => ({
            ...current,
            conversationTurns: current.conversationTurns + 1,
          }));
          patchActiveTurn(sessionKey, { runId: run.id });
          subscribeToStream(sessionKey, run.id);
        })
        .catch((err: unknown) => {
          onRunError?.(err);
          const message = err instanceof Error ? err.message : "Run creation failed.";
          updateSession(sessionKey, (current) => ({
            ...current,
            debugState: { status: "error", error: message },
          }));
          patchActiveTurn(sessionKey, { status: "error", error: message });
        });
    },
    [closeSessionStream, onRunError, patchActiveTurn, readSession, subscribeToStream, updateSession, workflowApi],
  );

  // Answers a paused Human Input interrupt and re-subscribes to the continuation.
  // Node states are kept so already-finished nodes stay rendered.
  const resumeRun = useCallback(
    (runId: string, request: ResumeRunRequest) => {
      const sessionKey =
        [...sessionsRef.current.entries()].find(([, session]) => session.debugState.waiting?.runId === runId)?.[0] ??
        activeSessionKeyRef.current;
      if (!sessionKey) return;
      closeSessionStream(sessionKey);
      const session = readSession(sessionKey);
      updateSession(sessionKey, () => ({ ...session, debugState: { status: "running" } }));
      if (session.activeChat) {
        patchActiveTurn(sessionKey, { status: "running" });
      }

      workflowApi
        .resumeRun(runId, request)
        .then(() => {
          subscribeToStream(sessionKey, runId);
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : "Resume failed.";
          updateSession(sessionKey, (current) => ({
            ...current,
            debugState: { status: "error", error: message },
          }));
          if (session.activeChat) {
            patchActiveTurn(sessionKey, { status: "error", error: message });
          }
        });
    },
    [closeSessionStream, patchActiveTurn, readSession, subscribeToStream, updateSession, workflowApi],
  );

  const newConversation = useCallback(() => {
    conversationIdRef.current = newConversationId();
    setConversationTurnsAndRef(0);
    setTranscriptAndRef([]);
    activeChatRef.current = false;
    setNodeStatesAndRef(new Map());
    setDebugStateAndRef({ status: "idle" });
  }, [setConversationTurnsAndRef, setDebugStateAndRef, setNodeStatesAndRef, setTranscriptAndRef]);

  const cleanup = useCallback(() => {
    for (const source of eventSourceRefs.current.values()) {
      source.close();
    }
    eventSourceRefs.current.clear();
    finishedBySessionRef.current.clear();
  }, []);

  return {
    nodeStates,
    debugState,
    setDebugState: setDebugStateAndRef,
    runWorkflow,
    sendChatMessage,
    transcript,
    resumeRun,
    newConversation,
    conversationTurns,
    cleanup,
    activateWorkflowSession,
    prepareWorkflowSessionSwitch,
    moveActiveWorkflowSession,
    resetWorkflowSession,
  };
}
