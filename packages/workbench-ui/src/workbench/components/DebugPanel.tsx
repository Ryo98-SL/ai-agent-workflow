import { useEffect, useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronRight, Loader2, Play } from "lucide-react";
import type { RunInput } from "@ai-agent-workflow/api-contracts";
import {
  resolveLLMModelSettings,
  type StartNode,
  type WorkflowFile,
  type WorkflowNode,
} from "@ai-agent-workflow/workflow-domain";
import type { DebugState, NodeExecutionState } from "../types";
import { Button } from "./Button";
import { JsonViewer } from "./JsonViewer";
import { NodeTypeIcon } from "./NodeTypeIcon";

type DebugPanelProps = {
  workflow: WorkflowFile;
  debugState: DebugState;
  nodeStates: Map<string, NodeExecutionState>;
  onRun: (input: RunInput) => void;
};

export function DebugPanel({ workflow, debugState, nodeStates, onRun }: DebugPanelProps) {
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

  const hasRun = nodeStates.size > 0 || Boolean(debugState.result);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-slate-200 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">Workflow Run</h2>
            <p className="mt-1 truncate text-xs text-slate-500">{startNode ? `${startNode.label} inputs` : "No Start node"}</p>
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
        {startNode && (
          <div className="mt-4 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Start Inputs</h3>
            {startNode.config.fields.length === 0 ? (
              <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-500">This workflow has no Start inputs.</p>
            ) : (
              startNode.config.fields.map((field) => (
                <label key={field.name} className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">
                    {field.label || field.name}
                    {field.required ? " *" : ""}
                  </span>
                  <input
                    value={values[field.name] ?? ""}
                    onChange={(event) => updateField(field.name, event.target.value)}
                    className="h-9 w-full rounded-md border border-slate-200 px-2 text-sm"
                    placeholder={field.defaultValue || field.name}
                  />
                </label>
              ))
            )}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {debugState.status === "idle" && !hasRun && (
          <EmptyState title="Ready to run" detail="Run the workflow to inspect server output and events." />
        )}
        {debugState.status === "loading" && (
          <EmptyState title="Loading" detail="The workbench is syncing workflow state with the server API." loading />
        )}
        {debugState.status === "running" && !hasRun && (
          <div className="space-y-3">
            <RunStatusHeader debugState={debugState} />
            <EmptyState title="Running" detail="Waiting for the first node to start…" loading />
          </div>
        )}
        {debugState.error && <ErrorBox message={debugState.error} />}
        {hasRun && (
          <div className="space-y-3">
            <RunStatusHeader debugState={debugState} />
            {nodeStates.size === 0 && debugState.status === "running" && (
              <EmptyState title="Running" detail="Waiting for the first node to start…" loading />
            )}
            <NodeCardList workflow={workflow} nodeStates={nodeStates} debugState={debugState} />
          </div>
        )}
      </div>
    </div>
  );
}

function RunStatusHeader({ debugState }: { debugState: DebugState }) {
  const run = debugState.result?.run;

  if (debugState.status === "running") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
        <Loader2 size={16} className="shrink-0 animate-spin text-emerald-600" aria-hidden />
        <span className="text-sm font-semibold text-emerald-700">Running workflow…</span>
      </div>
    );
  }

  if (run) {
    const failed = run.status === "failed";
    return (
      <div
        className={[
          "flex items-center gap-2 rounded-md border px-3 py-2",
          failed ? "border-rose-200 bg-rose-50" : "border-emerald-200 bg-emerald-50",
        ].join(" ")}
      >
        {failed ? (
          <AlertTriangle size={16} className="shrink-0 text-rose-600" aria-hidden />
        ) : (
          <CheckCircle2 size={16} className="shrink-0 text-emerald-600" aria-hidden />
        )}
        <span className={["text-sm font-semibold", failed ? "text-rose-700" : "text-emerald-700"].join(" ")}>
          {failed ? "Run failed" : "Run succeeded"}: {run.id}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <CheckCircle2 size={16} className="shrink-0 text-slate-400" aria-hidden />
      <span className="text-sm font-semibold text-slate-600">Run complete</span>
    </div>
  );
}

function formatDuration(ms?: number): string | undefined {
  if (ms === undefined) return undefined;
  return ms >= 1000 ? `${(ms / 1000).toFixed(3)} s` : `${ms} ms`;
}

function NodeCardList({
  workflow,
  nodeStates,
  debugState,
}: {
  workflow: WorkflowFile;
  nodeStates: Map<string, NodeExecutionState>;
  debugState: DebugState;
}) {
  const nodeIds = Array.from(nodeStates.keys());

  return (
    <div className="space-y-2">
      {nodeIds.map((nodeId) => {
        const state = nodeStates.get(nodeId)!;
        const workflowNode = workflow.graph.nodes.find((n) => n.id === nodeId);
        const label = workflowNode?.label ?? nodeId;
        return (
          <NodeCard key={nodeId} label={label} state={state} workflow={workflow} workflowNode={workflowNode} debugState={debugState} />
        );
      })}
    </div>
  );
}

type InspectorSections = {
  input?: unknown;
  processData?: unknown;
  outData?: unknown;
};

function isNonEmptyRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Object.keys(value as Record<string, unknown>).length > 0;
}

function buildInspectorSections(
  workflow: WorkflowFile,
  workflowNode: WorkflowNode | undefined,
  state: NodeExecutionState,
  runInput?: RunInput,
): InspectorSections {
  const sections: InspectorSections = {};

  if (workflowNode?.type === "start") {
    // Start node: surface the resolved input variables for debugging.
    const vars = isNonEmptyRecord(state.data) ? state.data : runInput;
    if (isNonEmptyRecord(vars)) {
      sections.input = vars;
    }
    return sections;
  }

  if (workflowNode?.type === "llm") {
    sections.input = {
      systemPrompt: workflowNode.config.systemPrompt ?? null,
      userPrompt: workflowNode.config.userPrompt,
    };
    const settings = resolveLLMModelSettings(workflow, workflowNode);
    if (settings) {
      sections.processData = {
        provider: settings.provider,
        model: settings.model,
        baseURL: settings.baseURL,
        temperature: settings.temperature ?? null,
        maxTokens: settings.maxTokens ?? null,
      };
    }
    if (isNonEmptyRecord(state.data)) {
      sections.outData = state.data;
    }
    return sections;
  }

  // Generic / placeholder nodes: config drives processing, data is the output.
  if (workflowNode && isNonEmptyRecord(workflowNode.config as Record<string, unknown>)) {
    sections.processData = workflowNode.config;
  }
  if (isNonEmptyRecord(state.data)) {
    sections.outData = state.data;
  }
  return sections;
}

function NodeCard({
  label,
  state,
  workflow,
  workflowNode,
  debugState,
}: {
  label: string;
  state: NodeExecutionState;
  workflow: WorkflowFile;
  workflowNode?: WorkflowNode;
  debugState: DebugState;
}) {
  const [expanded, setExpanded] = useState(state.status === "running");

  useEffect(() => {
    if (state.status === "running") {
      setExpanded(true);
    }
  }, [state.status]);

  const duration = formatDuration(state.durationMs);
  const sections = buildInspectorSections(workflow, workflowNode, state, debugState.result?.run.input);
  const readableText =
    state.nodeType === "llm"
      ? state.status === "succeeded"
        ? state.output || state.streamingText
        : state.streamingText
      : undefined;

  return (
    <div
      className="rounded-md border border-slate-200 bg-white overflow-hidden"
      style={{ animation: "nodeCardFadeIn 150ms ease-out" }}
    >
      <style>{`@keyframes nodeCardFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-50"
        onClick={() => setExpanded((v) => !v)}
      >
        <NodeTypeIcon type={state.nodeType} size={20} iconSize={11} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{label}</span>
        {duration && <span className="shrink-0 text-xs text-slate-400">{duration}</span>}
        {state.status === "running" && <Loader2 size={14} className="shrink-0 animate-spin text-emerald-600" aria-hidden />}
        {state.status === "succeeded" && <CheckCircle2 size={14} className="shrink-0 text-emerald-600" aria-hidden />}
        {state.status === "failed" && <AlertCircle size={14} className="shrink-0 text-rose-600" aria-hidden />}
      </button>
      {expanded && (
        <div className="border-t border-slate-100 px-3 py-2.5 space-y-3">
          {state.nodeType === "llm" && state.status === "running" && !state.streamingText && <TypingDots />}
          {readableText && (
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{readableText}</p>
          )}
          {state.nodeType === "llm" && (state.inputTokens !== undefined || state.outputTokens !== undefined) && (
            <p className="text-xs text-slate-400">
              {state.inputTokens ?? "?"} in · {state.outputTokens ?? "?"} out
            </p>
          )}
          {state.error && <ErrorBox message={state.error} />}
          {sections.input !== undefined && <InspectorSection title="Input" value={sections.input} />}
          {sections.processData !== undefined && <InspectorSection title="Process Data" value={sections.processData} />}
          {sections.outData !== undefined && <InspectorSection title="Out Data" value={sections.outData} />}
        </div>
      )}
    </div>
  );
}

/**
 * "Breathing" three-dot indicator shown while an LLM node is running but has not
 * streamed its first token yet, so the card never looks empty/stalled.
 */
function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1" role="status" aria-label="Generating response">
      <style>{`@keyframes debugTypingDot { 0%, 80%, 100% { opacity: 0.25; transform: scale(0.7); } 40% { opacity: 1; transform: scale(1); } }`}</style>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="size-1.5 rounded-full bg-slate-400"
          style={{ animation: "debugTypingDot 1.2s ease-in-out infinite", animationDelay: `${index * 0.16}s` }}
        />
      ))}
    </span>
  );
}

function InspectorSection({ title, value }: { title: string; value: unknown }) {
  const [open, setOpen] = useState(true);

  return (
    <section>
      <button
        type="button"
        className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700"
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronRight size={12} className={["transition-transform", open ? "rotate-90" : ""].join(" ")} aria-hidden />
        {title}
      </button>
      {open && (
        <div className="mt-1.5">
          <JsonViewer value={value} />
        </div>
      )}
    </section>
  );
}

function EmptyState({ title, detail, loading }: { title: string; detail: string; loading?: boolean }) {
  return (
    <div className="flex h-full min-h-40 flex-col items-center justify-center rounded-md border border-dashed border-slate-300 p-6 text-center">
      {loading && <Loader2 size={20} className="mb-3 animate-spin text-slate-500" aria-hidden />}
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{detail}</p>
    </div>
  );
}

function ErrorBox({ message, detail }: { message: string; detail?: string }) {
  return (
    <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
      <p className="font-medium">{message}</p>
      {detail && <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-xs">{detail}</pre>}
    </div>
  );
}
