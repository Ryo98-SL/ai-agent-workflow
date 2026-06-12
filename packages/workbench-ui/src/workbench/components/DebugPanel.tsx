import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2, MessagesSquare, Play, Workflow as WorkflowIcon } from "lucide-react";
import type { ResumeRunRequest, RunInput } from "@ai-agent-workflow/api-contracts";
import {
  type MemorySummarySettings,
  type StartNode,
  type WorkflowFile,
  type WorkflowMode,
} from "@ai-agent-workflow/workflow-domain";
import type { ChatTurn, DebugState, NodeExecutionState } from "../types";
import { Input } from "@workbench/components/ui/input";
import { Button } from "./Button";
import { ChatPanel } from "./ChatPanel";
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
  /** Chat Mode (workflow.metadata.mode === "chat") props. */
  transcript?: ChatTurn[];
  onSendMessage?: (query: string, baseInput: Record<string, string>) => void;
  onMemorySummaryChange?: (summary: MemorySummarySettings) => void;
  /** Switches the workflow between Workflow and Chat mode. */
  onSetMode?: (mode: WorkflowMode) => void;
  /**
   * Active sub-view. When provided, the panel is controlled so the route
   * persists across panel close/reopen; otherwise it manages its own state.
   */
  view?: "input" | "run";
  onViewChange?: (view: "input" | "run") => void;
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
  transcript = [],
  onSendMessage,
  onMemorySummaryChange,
  onSetMode,
  view: controlledView,
  onViewChange,
}: DebugPanelProps) {
  const hasMemory = workflow.graph.nodes.some((node) => node.type === "llm" && node.config.memory);
  const startNode = workflow.graph.nodes.find((node): node is StartNode => node.type === "start");
  const chatMode = workflow.metadata.mode === "chat";
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

  // The panel has two sub-views: "input" collects Start inputs, "run" shows the
  // live/last run output filling the whole panel. A run auto-switches to "run";
  // the user can navigate between them and the route is preserved across reopen
  // when the parent controls `view`. `hasRun` tells us whether there is any run
  // output to switch back to from the input view.
  const hasRun = debugState.status !== "idle" || nodeStates.size > 0 || Boolean(debugState.result);
  const [internalView, setInternalView] = useState<"input" | "run">(hasRun ? "run" : "input");
  const view = controlledView ?? internalView;
  const setView = onViewChange ?? setInternalView;
  const isRunActive = debugState.status === "running" || debugState.status === "waiting";
  useEffect(() => {
    if (isRunActive) {
      setView("run");
    }
    // setView is stable (either a parent setter or React's setState).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunActive]);

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
    setView("run");
    onRun(input);
  };

  // Chat Mode: a live conversation drives the workflow with `{{userInput.query}}`.
  // History (readOnly) still uses the run view since past chat turns aren't replayed.
  if (chatMode && !readOnly && onSendMessage) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {onSetMode && <ModeToggle mode="chat" onSetMode={onSetMode} disabled={debugState.status === "running"} />}
        <div className="min-h-0 flex-1">
          <ChatPanel
            workflow={workflow}
            startNode={startNode}
            transcript={transcript}
            debugState={debugState}
            nodeStates={nodeStates}
            conversationTurns={conversationTurns}
            onSendMessage={onSendMessage}
            onResumeRun={onResumeRun}
            onNewConversation={onNewConversation}
            onMemorySummaryChange={onMemorySummaryChange}
          />
        </div>
      </div>
    );
  }

  // History mode (readOnly) never collects inputs, so it is always the run view.
  if (readOnly || view === "run") {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {!readOnly && (
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Button
              variant="ghost"
              size="iconSm"
              onClick={() => setView("input")}
              aria-label="Back to inputs"
              title="Back to inputs"
            >
              <ArrowLeft size={16} aria-hidden />
            </Button>
            <span className="truncate text-xs font-medium text-muted-foreground">Run output</span>
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

  return (
    <div className="flex h-full min-h-0 flex-col">
      {onSetMode && <ModeToggle mode="workflow" onSetMode={onSetMode} disabled={debugState.status === "running"} />}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">Workflow Run</h2>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {startNode ? `${startNode.label} inputs` : "No Start node"}
            </p>
            {hasRun && (
              <button
                type="button"
                className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-brand transition-colors hover:text-brand/80"
                onClick={() => setView("run")}
              >
                View run output
                <ArrowRight size={13} aria-hidden />
              </button>
            )}
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
    </div>
  );
}

/** Segmented control switching the workflow between Workflow and Chat mode. */
function ModeToggle({
  mode,
  onSetMode,
  disabled,
}: {
  mode: WorkflowMode;
  onSetMode: (mode: WorkflowMode) => void;
  disabled?: boolean;
}) {
  const options: { value: WorkflowMode; label: string; icon: typeof WorkflowIcon }[] = [
    { value: "workflow", label: "运行", icon: WorkflowIcon },
    { value: "chat", label: "对话", icon: MessagesSquare },
  ];
  return (
    <div className="flex items-center gap-1 border-b border-border px-3 py-2">
      <div className="inline-flex rounded-md border border-border p-0.5">
        {options.map((option) => {
          const Icon = option.icon;
          const active = option.value === mode;
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled || active}
              onClick={() => onSetMode(option.value)}
              className={[
                "inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors",
                active ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground disabled:opacity-50",
              ].join(" ")}
            >
              <Icon size={13} aria-hidden />
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
