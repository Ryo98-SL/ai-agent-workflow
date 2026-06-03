import { useCallback, useRef, useState } from "react";
import { RunSseEventSchema, type CreateRunRequest } from "@ai-agent-workflow/api-contracts";
import type { DebugState, NodeExecutionState, WorkbenchWorkflowApi } from "../types";

export function useWorkflowExecution(workflowApi: WorkbenchWorkflowApi) {
  const [nodeStates, setNodeStates] = useState<Map<string, NodeExecutionState>>(() => new Map());
  const [debugState, setDebugState] = useState<DebugState>({ status: "idle" });
  const eventSourceRef = useRef<EventSource | null>(null);

  const runWorkflow = useCallback(
    (workflowId: string, request: CreateRunRequest) => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      setNodeStates(new Map());
      setDebugState({ status: "running" });

      workflowApi
        .createRun(workflowId, request)
        .then(({ run }) => {
          const source = new EventSource(workflowApi.runStreamUrl(run.id));
          eventSourceRef.current = source;

          source.onmessage = (msgEvent) => {
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
                .catch((err: unknown) => {
                  setDebugState({ status: runStatus === "failed" ? "error" : "success", result: { run, events: [] } });
                });
            }
          };

          source.onerror = () => {
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
