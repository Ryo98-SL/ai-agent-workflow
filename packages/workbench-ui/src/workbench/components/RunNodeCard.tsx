import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronRight, Loader2 } from "lucide-react";
import type { RunInput } from "@ai-agent-workflow/api-contracts";
import {
  resolveLLMModelSettings,
  type WorkflowFile,
  type WorkflowNode,
} from "@ai-agent-workflow/workflow-domain";
import type { DebugState, NodeExecutionState } from "../types";
import { JsonViewer } from "./JsonViewer";
import { NodeTypeIcon } from "./NodeTypeIcon";
import { RunErrorBox } from "./RunOutputPrimitives";

export function RunNodeCardList({
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
          <RunNodeCard
            key={nodeId}
            label={label}
            state={state}
            workflow={workflow}
            workflowNode={workflowNode}
            debugState={debugState}
          />
        );
      })}
    </div>
  );
}

export type InspectorSections = {
  input?: unknown;
  processData?: unknown;
  outData?: unknown;
};

function isNonEmptyRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Object.keys(value as Record<string, unknown>).length > 0;
}

export function buildInspectorSections(
  workflow: WorkflowFile,
  workflowNode: WorkflowNode | undefined,
  state: NodeExecutionState,
  runInput?: RunInput,
): InspectorSections {
  const sections: InspectorSections = {};

  if (workflowNode?.type === "start") {
    const vars = isNonEmptyRecord(state.data) ? state.data : runInput;
    if (isNonEmptyRecord(vars)) {
      sections.input = vars;
    }
    return sections;
  }

  if (workflowNode?.type === "llm") {
    sections.input = {
      messages: workflowNode.config.messages,
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

  if (workflowNode && isNonEmptyRecord(workflowNode.config as Record<string, unknown>)) {
    sections.processData = workflowNode.config;
  }
  if (isNonEmptyRecord(state.data)) {
    sections.outData = state.data;
  }
  return sections;
}

export function formatRunDuration(ms?: number): string | undefined {
  if (ms === undefined) return undefined;
  return ms >= 1000 ? `${(ms / 1000).toFixed(3)} s` : `${ms} ms`;
}

function RunNodeCard({
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

  const duration = formatRunDuration(state.durationMs);
  const sections = buildInspectorSections(workflow, workflowNode, state, debugState.result?.run.input);
  const readableText =
    state.nodeType === "llm"
      ? state.status === "succeeded"
        ? state.output || state.streamingText
        : state.streamingText
      : undefined;

  return (
    <div
      className="overflow-hidden rounded-md border border-border bg-card"
      style={{ animation: "nodeCardFadeIn 150ms ease-out" }}
    >
      <style>{`@keyframes nodeCardFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-accent"
        onClick={() => setExpanded((v) => !v)}
      >
        <NodeTypeIcon type={state.nodeType} size={20} iconSize={11} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{label}</span>
        {duration && <span className="shrink-0 text-xs text-muted-foreground">{duration}</span>}
        {state.status === "running" && <Loader2 size={14} className="shrink-0 animate-spin text-brand" aria-hidden />}
        {state.status === "succeeded" && <CheckCircle2 size={14} className="shrink-0 text-brand" aria-hidden />}
        {state.status === "failed" && <AlertCircle size={14} className="shrink-0 text-destructive" aria-hidden />}
      </button>
      {expanded && (
        <div className="border-t border-border px-3 py-2.5">
          <RunNodeExecutionDetails
            readableText={readableText}
            sections={sections}
            state={state}
          />
        </div>
      )}
    </div>
  );
}

export function RunNodeExecutionDetails({
  readableText,
  sections,
  state,
}: {
  readableText?: string;
  sections: InspectorSections;
  state: NodeExecutionState;
}) {
  return (
    <div className="space-y-3">
      {state.nodeType === "llm" && state.status === "running" && !state.streamingText && <TypingDots />}
      {readableText && <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{readableText}</p>}
      {state.nodeType === "llm" && (state.inputTokens !== undefined || state.outputTokens !== undefined) && (
        <p className="text-xs text-muted-foreground">
          {state.inputTokens ?? "?"} in · {state.outputTokens ?? "?"} out
        </p>
      )}
      {state.error && <RunErrorBox message={state.error} />}
      {sections.input !== undefined && <InspectorSection title="Input" value={sections.input} />}
      {sections.processData !== undefined && <InspectorSection title="Process Data" value={sections.processData} />}
      {sections.outData !== undefined && <InspectorSection title="Out Data" value={sections.outData} />}
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1" role="status" aria-label="Generating response">
      <style>{`@keyframes debugTypingDot { 0%, 80%, 100% { opacity: 0.25; transform: scale(0.7); } 40% { opacity: 1; transform: scale(1); } }`}</style>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="size-1.5 rounded-full bg-muted-foreground"
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
        className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
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
