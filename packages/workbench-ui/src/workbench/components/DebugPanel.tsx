import { useEffect, useMemo, useState } from "react";
import { Loader2, Play } from "lucide-react";
import type { ResumeRunRequest, RunInput } from "@ai-agent-workflow/api-contracts";
import { type StartNode, type WorkflowFile } from "@ai-agent-workflow/workflow-domain";
import type { DebugState, NodeExecutionState } from "../types";
import { Input } from "@workbench/components/ui/input";
import { Button } from "./Button";
import { HumanReviewForm } from "./HumanReviewForm";
import { RunOutput } from "./RunOutput";

type DebugPanelProps = {
  workflow: WorkflowFile;
  debugState: DebugState;
  nodeStates: Map<string, NodeExecutionState>;
  onRun: (input: RunInput) => void;
  onResumeRun?: (runId: string, request: ResumeRunRequest) => void;
  onNewConversation?: () => void;
  conversationTurns?: number;
  readOnly?: boolean;
};

export function DebugPanel({
  workflow,
  debugState,
  nodeStates,
  onRun,
  onResumeRun,
  onNewConversation,
  conversationTurns = 0,
  readOnly = false,
}: DebugPanelProps) {
  const hasMemory = workflow.graph.nodes.some((node) => node.type === "llm" && node.config.memory);
  const startNode = workflow.graph.nodes.find((node): node is StartNode => node.type === "start");
  const initialValues = useMemo(
    () =>
      Object.fromEntries(
        (startNode?.config.fields ?? []).map((field) => [field.name, field.defaultValue ?? ""]),
      ) as Record<string, string>,
    [startNode],
  );
  const [values, setValues] = useState<Record<string, string>>(initialValues);

  useEffect(() => {
    setValues((current) => ({ ...initialValues, ...current }));
  }, [initialValues]);

  const updateField = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const submitRun = () => {
    const input: RunInput = {};
    for (const field of startNode?.config.fields ?? []) {
      const value = values[field.name];
      if (value !== undefined && value !== "") {
        input[field.name] = value;
      }
    }
    onRun(input);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {!readOnly && (
        <div className="border-b border-border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold">Workflow Run</h2>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {startNode ? `${startNode.label} inputs` : "No Start node"}
              </p>
            </div>
            <Button
              variant="success"
              size="md"
              disabled={!startNode || debugState.status === "running"}
              onClick={submitRun}
            >
              {debugState.status === "running" ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
              Run workflow
            </Button>
          </div>
          {hasMemory && (
            <div className="mt-3 flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
              <span className="text-xs text-muted-foreground">
                Conversation memory on · {conversationTurns} turn{conversationTurns === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                className="text-xs font-medium text-brand transition-colors hover:text-brand/80 disabled:opacity-50"
                disabled={debugState.status === "running" || conversationTurns === 0}
                onClick={() => onNewConversation?.()}
              >
                New conversation
              </button>
            </div>
          )}
          {startNode && (
            <div className="mt-4 space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Start Inputs</h3>
              {startNode.config.fields.length === 0 ? (
                <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                  This workflow has no Start inputs.
                </p>
              ) : (
                startNode.config.fields.map((field) => (
                  <label key={field.name} className="block">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">
                      {field.label || field.name}
                      {field.required ? " *" : ""}
                    </span>
                    <Input
                      value={values[field.name] ?? ""}
                      onChange={(event) => updateField(field.name, event.target.value)}
                      placeholder={field.defaultValue || field.name}
                    />
                  </label>
                ))
              )}
            </div>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {!readOnly && debugState.status === "waiting" && debugState.waiting && onResumeRun && (
          <HumanReviewForm
            runId={debugState.waiting.runId}
            interrupt={debugState.waiting.interrupt}
            onResumeRun={onResumeRun}
          />
        )}
        <RunOutput workflow={workflow} debugState={debugState} nodeStates={nodeStates} />
      </div>
    </div>
  );
}
