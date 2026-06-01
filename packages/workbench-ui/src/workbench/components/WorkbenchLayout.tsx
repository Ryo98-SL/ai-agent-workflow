import type { Dispatch, SetStateAction } from "react";
import { FilePlus2, Loader2, Play, Plus, Settings } from "lucide-react";
import type {
  OpenAICompatibleSettings,
  WorkflowFile,
  WorkflowNode,
  WorkflowNodeType,
} from "@ai-agent-workflow/workflow-domain";
import { DebugPanel } from "./DebugPanel";
import { FloatingPanel } from "./FloatingPanel";
import { ModelSettingsPanel } from "./ModelSettingsPanel";
import { NodeInspector } from "./NodeInspector";
import { NodePalette } from "./NodePalette";
import { ProjectFileActions } from "./ProjectFileActions";
import { WorkflowCanvas } from "./WorkflowCanvas";
import type { DebugState } from "../types";

type WorkbenchLayoutProps = {
  workflow: WorkflowFile;
  workflowId?: string;
  dirty: boolean;
  selectedNode?: WorkflowNode;
  selectedNodeId: string;
  debugState: DebugState;
  paletteOpen: boolean;
  settingsOpen: boolean;
  inspectorOpen: boolean;
  debugOpen: boolean;
  onAddNode: (type: WorkflowNodeType) => void;
  onCloseDebug: () => void;
  onCloseInspector: () => void;
  onClosePalette: () => void;
  onCloseSettings: () => void;
  onNewWorkflow: () => void;
  onOpenWorkflow: () => void;
  onRunSelectedNode: (testVariables: Record<string, string>) => void;
  onSaveWorkflow: () => void;
  onSaveWorkflowAs: () => void;
  onSelectNode: (nodeId: string) => void;
  onTogglePalette: () => void;
  onToggleSettings: () => void;
  onUpdateModelSettings: (settings: OpenAICompatibleSettings) => void;
  onUpdateNode: (nodeId: string, updater: (node: WorkflowNode) => WorkflowNode) => void;
  onWorkflowChange: Dispatch<SetStateAction<WorkflowFile>>;
};

export function WorkbenchLayout({
  workflow,
  workflowId,
  dirty,
  selectedNode,
  selectedNodeId,
  debugState,
  paletteOpen,
  settingsOpen,
  inspectorOpen,
  debugOpen,
  onAddNode,
  onCloseDebug,
  onCloseInspector,
  onClosePalette,
  onCloseSettings,
  onNewWorkflow,
  onOpenWorkflow,
  onRunSelectedNode,
  onSaveWorkflow,
  onSaveWorkflowAs,
  onSelectNode,
  onTogglePalette,
  onToggleSettings,
  onUpdateModelSettings,
  onUpdateNode,
  onWorkflowChange,
}: WorkbenchLayoutProps) {
  const executable = selectedNode?.type === "llm" || selectedNode?.type === "tool";

  return (
    <main className="relative h-full min-h-0 overflow-hidden bg-slate-50 text-slate-950">
      <section className="absolute inset-x-0 bottom-0 top-16">
        <WorkflowCanvas
          workflow={workflow}
          selectedNodeId={selectedNodeId}
          onSelectNode={onSelectNode}
          onWorkflowChange={onWorkflowChange}
        />
      </section>

      <header className="absolute inset-x-0 top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 shadow-sm backdrop-blur">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-600 text-white">
          <FilePlus2 size={20} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold">{workflow.metadata.name}</h1>
          <p className="truncate text-xs text-slate-500">
            {workflowId ? `Server workflow: ${workflowId}` : "Unsaved server workflow"} {dirty ? "• unsaved changes" : ""}
          </p>
        </div>
        <ProjectFileActions
          dirty={dirty}
          filePath={workflowId}
          onNew={onNewWorkflow}
          onOpen={onOpenWorkflow}
          onSave={onSaveWorkflow}
          onSaveAs={onSaveWorkflowAs}
        />
        <button
          type="button"
          onClick={onToggleSettings}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-100"
          aria-expanded={settingsOpen}
          aria-controls="workbench-model-settings"
          aria-label="Open model settings"
          title="Model settings"
        >
          <Settings size={18} aria-hidden />
        </button>
      </header>

      <div className="absolute left-4 top-24 z-20">
        <button
          type="button"
          onClick={onTogglePalette}
          className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-800 shadow-lg shadow-slate-900/10 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
          aria-expanded={paletteOpen}
          aria-controls="workbench-node-palette"
          aria-label="Open node palette"
          title="Node palette"
        >
          <Plus size={21} aria-hidden />
        </button>
      </div>

      <div className="absolute right-4 top-24 z-20">
        <button
          type="button"
          disabled={!executable || debugState.status === "running"}
          onClick={() => onRunSelectedNode({})}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 text-sm font-medium text-emerald-700 shadow-lg shadow-slate-900/10 hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
          aria-label="Run"
          title={selectedNode ? "Run selected node" : "Select a runnable node first"}
        >
          {debugState.status === "running" ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Play size={16} aria-hidden />}
          Run
        </button>
      </div>

      {paletteOpen && (
        <FloatingPanel
          title="Node Palette"
          description="Add nodes to the workflow canvas."
          closeLabel="Close node palette"
          onClose={onClosePalette}
          className="absolute left-4 top-40 z-30 h-[min(70vh,560px)] w-[300px]"
        >
          <div id="workbench-node-palette" className="h-full">
            <NodePalette onAddNode={onAddNode} />
          </div>
        </FloatingPanel>
      )}

      {settingsOpen && (
        <FloatingPanel
          title="Model Settings"
          description="Configure the default model provider."
          closeLabel="Close model settings"
          onClose={onCloseSettings}
          className="absolute right-4 top-20 z-40 w-[360px]"
        >
          <div id="workbench-model-settings">
            <ModelSettingsPanel settings={workflow.settings.modelProvider} onChange={onUpdateModelSettings} />
          </div>
        </FloatingPanel>
      )}

      {inspectorOpen && selectedNode && (
        <FloatingPanel
          title="Node Inspector"
          description={selectedNode.label}
          closeLabel="Close node inspector"
          onClose={onCloseInspector}
          className="absolute bottom-4 right-4 top-20 z-30 w-[380px]"
        >
          <div className="h-full overflow-y-auto">
            <NodeInspector selectedNode={selectedNode} updateNode={onUpdateNode} />
          </div>
        </FloatingPanel>
      )}

      {debugOpen && selectedNode && (
        <FloatingPanel
          title="Run Log"
          description={`${selectedNode.label} (${selectedNode.type})`}
          closeLabel="Close run log"
          onClose={onCloseDebug}
          className={["absolute right-4 top-40 z-40 h-[min(70vh,560px)]", inspectorOpen ? "w-[420px]" : "w-[560px]"].join(" ")}
        >
          <div className="h-full overflow-hidden">
            <DebugPanel selectedNode={selectedNode} debugState={debugState} onRun={onRunSelectedNode} />
          </div>
        </FloatingPanel>
      )}
    </main>
  );
}
