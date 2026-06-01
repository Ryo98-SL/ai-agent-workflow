import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Play } from "lucide-react";
import { parsePromptVariables } from "@ai-agent-workflow/workflow-domain";
import type { WorkflowNode } from "@ai-agent-workflow/workflow-domain";
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
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-slate-200 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">Run Controls</h2>
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
            Run again
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
            Select an LLM or Current Time tool node to run the server mock workflow.
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {debugState.status === "idle" && (
          <EmptyState title="Ready to run" detail="Run an executable node to inspect server run output and events." />
        )}
        {debugState.status === "running" && (
          <EmptyState title="Running" detail="The workflow is running through the server API." loading />
        )}
        {debugState.status === "loading" && (
          <EmptyState title="Loading" detail="The workbench is syncing workflow state with the server API." loading />
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
  const run = result.run;
  const failed = run.status === "failed";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {!failed ? (
          <CheckCircle2 size={18} className="text-emerald-600" aria-hidden />
        ) : (
          <AlertTriangle size={18} className="text-rose-600" aria-hidden />
        )}
        <h3 className="text-sm font-semibold">
          {!failed ? "Run succeeded" : "Run failed"}: {run.id}
        </h3>
      </div>
      {run.error && <ErrorBox message={run.error.message} detail={JSON.stringify(run.error, null, 2)} />}
      {run.output && (
        <ResultSection title="Server Run Output">
          <div className="rounded-md border border-slate-200 bg-white p-3 text-sm leading-6">{run.output.summary}</div>
          <div className="mt-3 space-y-2">
            {run.output.nodeResults.map((nodeResult) => (
              <div key={nodeResult.nodeId} className="rounded-md bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{nodeResult.label}</p>
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                    {nodeResult.status}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{nodeResult.output}</p>
              </div>
            ))}
          </div>
        </ResultSection>
      )}
      <ResultSection title="Run Details">
        <pre className="max-h-52 overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-100">
          {JSON.stringify(
            {
              id: run.id,
              workflowId: run.workflowId,
              status: run.status,
              createdAt: run.createdAt,
              startedAt: run.startedAt,
              completedAt: run.completedAt,
              input: run.input,
            },
            null,
            2,
          )}
        </pre>
      </ResultSection>
      {result.events.length > 0 && (
        <ResultSection title="Run Events">
          <pre className="max-h-52 overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-100">
            {JSON.stringify(result.events, null, 2)}
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
