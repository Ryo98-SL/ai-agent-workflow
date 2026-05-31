import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Play } from "lucide-react";
import { parsePromptVariables } from "../../domain/workflow/promptVariables";
import type { WorkflowNode } from "../../domain/workflow/schema";
import type { DebugState } from "../types";

type DebugPanelProps = {
  selectedNode?: WorkflowNode;
  debugState: DebugState;
  onRun: (testVariables: Record<string, string>) => void;
};

export function DebugPanel({ selectedNode, debugState, onRun }: DebugPanelProps) {
  const [testVariables, setTestVariables] = useState<Record<string, string>>({});
  const requiredVariables = useMemo(() => {
    if (selectedNode?.type !== "llm") {
      return [];
    }
    return parsePromptVariables(`${selectedNode.config.systemPrompt || ""}\n${selectedNode.config.userPrompt}`);
  }, [selectedNode]);

  const executable = selectedNode?.type === "llm" || selectedNode?.type === "tool";

  const updateVariable = (key: string, value: string) => {
    setTestVariables((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="grid h-full grid-cols-[320px_minmax(0,1fr)]">
      <aside className="border-r border-slate-200 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">Debug</h2>
            <p className="mt-1 truncate text-xs text-slate-500">
              {selectedNode ? `${selectedNode.label} (${selectedNode.type})` : "No node selected"}
            </p>
          </div>
          <button
            type="button"
            disabled={!executable || debugState.status === "running"}
            onClick={() => onRun(testVariables)}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {debugState.status === "running" ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
            Run
          </button>
        </div>
        {selectedNode?.type === "llm" && (
          <div className="mt-4 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Test Variables</h3>
            {requiredVariables.length === 0 ? (
              <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-500">No variables detected.</p>
            ) : (
              requiredVariables.map((variable) => (
                <label key={variable} className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">{variable}</span>
                  <input
                    value={testVariables[variable] ?? ""}
                    onChange={(event) => updateVariable(variable, event.target.value)}
                    className="h-9 w-full rounded-md border border-slate-200 px-2 text-sm"
                    placeholder="Override inspector value for this run"
                  />
                </label>
              ))
            )}
          </div>
        )}
        {!executable && (
          <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm leading-5 text-slate-500">
            Select an LLM or Current Time tool node to run a real MVP adapter.
          </p>
        )}
      </aside>

      <div className="min-w-0 overflow-y-auto p-4">
        {debugState.status === "idle" && (
          <EmptyState title="Ready to run" detail="Run an executable node to inspect prompts, requests, responses, and errors." />
        )}
        {debugState.status === "running" && (
          <EmptyState title="Running" detail="The selected node is executing through the runtime adapter." loading />
        )}
        {debugState.error && <ErrorBox message={debugState.error} />}
        {debugState.result && <RuntimeResultView debugState={debugState} />}
      </div>
    </div>
  );
}

function RuntimeResultView({ debugState }: { debugState: DebugState }) {
  const result = debugState.result;
  if (!result) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {result.status === "success" ? (
          <CheckCircle2 size={18} className="text-emerald-600" aria-hidden />
        ) : (
          <AlertTriangle size={18} className="text-rose-600" aria-hidden />
        )}
        <h3 className="text-sm font-semibold">
          {result.status === "success" ? "Run succeeded" : "Run failed"} in {result.latencyMs}ms
        </h3>
      </div>
      {result.error && <ErrorBox message={result.error.message} detail={result.error.detail} />}
      {result.resolvedPrompt && (
        <ResultSection title="Resolved Prompt">
          {result.resolvedPrompt.system && <CodeBlock label="system" value={result.resolvedPrompt.system} />}
          {result.resolvedPrompt.user && <CodeBlock label="user" value={result.resolvedPrompt.user} />}
        </ResultSection>
      )}
      {result.request && (
        <ResultSection title="Request Summary">
          <pre className="max-h-52 overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-100">
            {JSON.stringify(result.request, null, 2)}
          </pre>
        </ResultSection>
      )}
      {result.responseText !== undefined && (
        <ResultSection title="Response">
          <div className="whitespace-pre-wrap rounded-md border border-slate-200 bg-white p-3 text-sm leading-6">
            {result.responseText || "No response text returned."}
          </div>
        </ResultSection>
      )}
      {result.rawResponseSummary && (
        <ResultSection title="Raw Response Summary">
          <pre className="max-h-44 overflow-auto rounded-md bg-slate-100 p-3 text-xs text-slate-700">
            {result.rawResponseSummary}
          </pre>
        </ResultSection>
      )}
    </div>
  );
}

function ResultSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      {children}
    </section>
  );
}

function CodeBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-2">
      <p className="mb-1 text-xs font-medium text-slate-500">{label}</p>
      <pre className="max-h-40 overflow-auto rounded-md bg-slate-100 p-3 text-xs leading-5 text-slate-800">{value}</pre>
    </div>
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
