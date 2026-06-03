import type { Dispatch, SetStateAction } from "react";
import { FilePlus2, Loader2, Play, Plus, Settings } from "lucide-react";
import type {
  ModelProviderKeys,
  OpenAICompatibleSettings,
  WorkflowFile,
  WorkflowNode,
  WorkflowNodeType,
} from "@ai-agent-workflow/workflow-domain";
import type { RunInput } from "@ai-agent-workflow/api-contracts";
import { Button } from "./Button";
import { DebugPanel } from "./DebugPanel";
import { FloatingPanel } from "./FloatingPanel";
import { ModelSettingsPanel } from "./ModelSettingsPanel";
import { NodeInspector } from "./NodeInspector";
import { NodePalette } from "./NodePalette";
import { Popover } from "./Popover";
import { ProjectFileActions } from "./ProjectFileActions";
import { WorkflowCanvas } from "./WorkflowCanvas";
import type { AddNodeOptions, DebugState } from "../types";

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
  showDevModelProviders: boolean;
  onAddNode: (type: WorkflowNodeType, options?: AddNodeOptions) => void;
  onCloseDebug: () => void;
  onCloseInspector: () => void;
  onClosePalette: () => void;
  onCloseSettings: () => void;
  onNewWorkflow: () => void;
  onOpenWorkflow: () => void;
  onToggleRunPanel: () => void;
  onRunWorkflow: (input: RunInput) => void;
  onSaveWorkflow: () => void;
  onSaveWorkflowAs: () => void;
  onSelectNode: (nodeId: string) => void;
  onTogglePalette: () => void;
  onToggleSettings: () => void;
  onUpdateModelSettings: (settings: OpenAICompatibleSettings, providerKeys: ModelProviderKeys) => void;
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
  showDevModelProviders,
  onAddNode,
  onCloseDebug,
  onCloseInspector,
  onClosePalette,
  onCloseSettings,
  onNewWorkflow,
  onOpenWorkflow,
  onToggleRunPanel,
  onRunWorkflow,
  onSaveWorkflow,
  onSaveWorkflowAs,
  onSelectNode,
  onTogglePalette,
  onToggleSettings,
  onUpdateModelSettings,
  onUpdateNode,
  onWorkflowChange,
}: WorkbenchLayoutProps) {
  const hasStartNode = workflow.graph.nodes.some((node) => node.type === "start");

  return (
    <main className="relative h-full min-h-0 overflow-hidden bg-slate-50 text-slate-950">
      <section className="absolute inset-x-0 bottom-0 top-16">
        <WorkflowCanvas
          workflow={workflow}
          selectedNodeId={selectedNodeId}
          onAddNode={onAddNode}
          onClearSelection={onCloseInspector}
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
        <Popover
          id="workbench-model-settings"
          open={settingsOpen}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              onCloseSettings();
            }
          }}
          placement="bottom-end"
          renderTrigger={({ ref, props }) => (
            <Button
              {...props}
              ref={ref}
              variant="secondary"
              size="iconMd"
              onClick={onToggleSettings}
              aria-label="Open model settings"
              title="Model settings"
            >
              <Settings size={16} aria-hidden />
            </Button>
          )}
        >
          <FloatingPanel
            title="Model Settings"
            description="Configure the default model provider."
            closeLabel="Close model settings"
            onClose={onCloseSettings}
            className="w-[360px]"
          >
            <ModelSettingsPanel
              settings={workflow.settings.modelProvider}
              providerKeys={workflow.settings.modelProviderKeys}
              showDevModelProviders={showDevModelProviders}
              onChange={onUpdateModelSettings}
            />
          </FloatingPanel>
        </Popover>
      </header>

      <div className="absolute left-4 top-24 z-20">
        <Popover
          id="workbench-node-palette"
          open={paletteOpen}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              onClosePalette();
            }
          }}
          placement="bottom-start"
          renderTrigger={({ ref, props }) => (
            <Button
              {...props}
              ref={ref}
              variant="secondary"
              size="iconMd"
              className="text-slate-800 shadow-lg shadow-slate-900/10 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
              onClick={onTogglePalette}
              aria-label="Open node palette"
              title="Node palette"
            >
              <Plus size={18} aria-hidden />
            </Button>
          )}
        >
          <FloatingPanel
            title="Node Palette"
            description="Add nodes to the workflow canvas."
            closeLabel="Close node palette"
            onClose={onClosePalette}
            className="h-[min(70vh,560px)] w-[300px]"
          >
            <div className="h-full">
              <NodePalette hasStartNode={hasStartNode} onAddNode={onAddNode} />
            </div>
          </FloatingPanel>
        </Popover>
      </div>

      <div className={["absolute top-24 z-20", inspectorOpen ? "right-[412px]" : "right-4"].join(" ")}>
        <Popover
          id="workbench-run-log"
          open={debugOpen}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              onCloseDebug();
            }
          }}
          placement="bottom-end"
          offset={10}
          renderTrigger={({ ref, props }) => (
            <Button
              {...props}
              ref={ref}
              variant="successSoft"
              size="icon"
              disabled={!hasStartNode || debugState.status === "running"}
              onClick={onToggleRunPanel}
              aria-label="Run workflow"
              title={hasStartNode ? "Run workflow" : "Add a Start node first"}
            >
              {debugState.status === "running" ? (
                <Loader2 size={16} className="animate-spin" aria-hidden />
              ) : (
                <Play size={16} aria-hidden />
              )}
            </Button>
          )}
        >
          <FloatingPanel
            title="Run Log"
            description="Workflow run"
            closeLabel="Close run log"
            onClose={onCloseDebug}
            className={["h-[min(70vh,560px)]", inspectorOpen ? "w-[420px]" : "w-[560px]"].join(" ")}
          >
            <div className="h-full overflow-hidden">
              <DebugPanel workflow={workflow} debugState={debugState} onRun={onRunWorkflow} />
            </div>
          </FloatingPanel>
        </Popover>
      </div>

      {inspectorOpen && selectedNode && (
        <FloatingPanel
          title="Node Inspector"
          description={selectedNode.label}
          closeLabel="Close node inspector"
          onClose={onCloseInspector}
          className="absolute bottom-4 right-4 top-20 z-30 w-[380px]"
        >
          <div className="h-full overflow-y-auto">
            <NodeInspector
              workflow={workflow}
              selectedNode={selectedNode}
              showDevModelProviders={showDevModelProviders}
              updateNode={onUpdateNode}
            />
          </div>
        </FloatingPanel>
      )}

    </main>
  );
}
