import { Loader2, Play, Plus, Settings } from "lucide-react";
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
import { NodeInspector, NodeInspectorPanelTitle } from "./NodeInspector";
import { NodePalette } from "./NodePalette";
import { Popover } from "./Popover";
import { ProjectFileActions } from "./ProjectFileActions";
import { ThemeMenu } from "../../theme/ThemeMenu";
import { AuthMenu } from "../../auth/AuthMenu";
import { RunHistoryMenu } from "./RunHistoryMenu";
import { WorkflowSwitcher } from "./WorkflowSwitcher";
import { WorkflowMetaEditor, type WorkflowMetaPatch } from "./WorkflowMetaEditor";
import { WorkflowCanvas } from "./WorkflowCanvas";
import type { WorkflowGraphHistoryEntry } from "../hooks/useWorkflowGraphHistory";
import type { AddNodeOptions, DebugState, NodeExecutionState } from "../types";

type WorkbenchLayoutProps = {
  workflow: WorkflowFile;
  workflowId?: string;
  dirty: boolean;
  selectedNode?: WorkflowNode;
  selectedNodeId: string;
  debugState: DebugState;
  viewedDebugState?: DebugState;
  nodeStates: Map<string, NodeExecutionState>;
  paletteOpen: boolean;
  settingsOpen: boolean;
  inspectorOpen: boolean;
  debugOpen: boolean;
  showDevModelProviders: boolean;
  canRedo: boolean;
  canUndo: boolean;
  onAddNode: (type: WorkflowNodeType, options?: AddNodeOptions) => void;
  onCloseDebug: () => void;
  onCloseInspector: () => void;
  onClosePalette: () => void;
  onCloseSettings: () => void;
  onCommitGraphHistoryEntry: (entry: WorkflowGraphHistoryEntry) => void;
  onRedo: () => void;
  onToggleRunPanel: () => void;
  onRunWorkflow: (input: RunInput) => void;
  onOpenHistoricalRun: (runId: string) => void;
  onSwitchWorkflow: (id: string) => void;
  onCreateWorkflow: () => void;
  onDeleteWorkflow: (id: string) => void;
  onUpdateWorkflowMeta: (patch: WorkflowMetaPatch) => void;
  onSaveWorkflow: () => void;
  onSelectNode: (nodeId: string) => void;
  onTogglePalette: () => void;
  onToggleSettings: () => void;
  onUndo: () => void;
  onUpdateModelSettings: (settings: OpenAICompatibleSettings, providerKeys: ModelProviderKeys) => void;
  onUpdateNode: (nodeId: string, updater: (node: WorkflowNode) => WorkflowNode) => void;
};

export function WorkbenchLayout({
  workflow,
  workflowId,
  dirty,
  selectedNode,
  selectedNodeId,
  debugState,
  viewedDebugState,
  nodeStates,
  paletteOpen,
  settingsOpen,
  inspectorOpen,
  debugOpen,
  showDevModelProviders,
  canRedo,
  canUndo,
  onAddNode,
  onCloseDebug,
  onCloseInspector,
  onClosePalette,
  onCloseSettings,
  onCommitGraphHistoryEntry,
  onRedo,
  onToggleRunPanel,
  onRunWorkflow,
  onOpenHistoricalRun,
  onSwitchWorkflow,
  onCreateWorkflow,
  onDeleteWorkflow,
  onUpdateWorkflowMeta,
  onSaveWorkflow,
  onSelectNode,
  onTogglePalette,
  onToggleSettings,
  onUndo,
  onUpdateModelSettings,
  onUpdateNode,
}: WorkbenchLayoutProps) {
  const hasStartNode = workflow.graph.nodes.some((node) => node.type === "start");
  const debugPanelState = viewedDebugState ?? debugState;
  const debugPanelNodeStates = viewedDebugState ? new Map<string, NodeExecutionState>() : nodeStates;
  const debugPanelReadOnly = Boolean(viewedDebugState);

  return (
    <main className="relative h-full min-h-0 flex flex-col overflow-hidden bg-background text-foreground">
      <header className="z-30 flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card/95 px-4 shadow-sm backdrop-blur">
        <WorkflowSwitcher
          workflow={workflow}
          workflowId={workflowId}
          dirty={dirty}
          onSwitch={onSwitchWorkflow}
          onCreate={onCreateWorkflow}
          onDelete={onDeleteWorkflow}
        />
        <WorkflowMetaEditor workflow={workflow} onUpdateMeta={onUpdateWorkflowMeta} />
        <div className="min-w-0 flex-1" />
        <ProjectFileActions dirty={dirty} filePath={workflowId} onSave={onSaveWorkflow} />
        <RunHistoryMenu workflowId={workflowId} onOpenRun={onOpenHistoricalRun} />
        <ThemeMenu />
        <AuthMenu />
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

      <section className=" flex-1 relative h-full ">
        <WorkflowCanvas
          workflow={workflow}
          selectedNodeId={selectedNodeId}
          nodeStates={nodeStates}
          canRedo={canRedo}
          canUndo={canUndo}
          onAddNode={onAddNode}
          onClearSelection={onCloseInspector}
          onCommitGraphHistoryEntry={onCommitGraphHistoryEntry}
          onRedo={onRedo}
          onSelectNode={onSelectNode}
          onUndo={onUndo}
        />
      </section>



      <div className="absolute left-4 top-1/2 z-20 -translate-y-1/2">
        <Popover
          id="workbench-node-palette"
          open={paletteOpen}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              onClosePalette();
            }
          }}
          placement="right"
          renderTrigger={({ ref, props }) => (
            <Button
              {...props}
              ref={ref}
              variant="secondary"
              size="iconMd"
              className="text-foreground shadow-lg shadow-black/10"
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

      {/* Hide the run trigger while the inspector occupies the right rail. */}
      {!inspectorOpen && (
        <div className="absolute right-4 top-14 z-16">
          <Popover
            id="workbench-run-log"
            open={debugOpen}
            onOpenChange={(nextOpen) => {
              if (!nextOpen) {
                onCloseDebug();
              }
            }}
            placement="bottom-end"
            offset={4}
            fillAvailableHeight
            availableHeightPadding={2}
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
              title={debugPanelReadOnly ? "Run History" : "Run Log"}
              description={debugPanelReadOnly ? "Historical run" : "Workflow run"}
              closeLabel="Close run log"
              onClose={onCloseDebug}
              className="h-full w-[560px]"
            >
              <div className="h-full overflow-hidden">
                <DebugPanel
                  workflow={workflow}
                  debugState={debugPanelState}
                  nodeStates={debugPanelNodeStates}
                  onRun={onRunWorkflow}
                  readOnly={debugPanelReadOnly}
                />
              </div>
            </FloatingPanel>
          </Popover>
        </div>
      )}

      {inspectorOpen && selectedNode && (
        <FloatingPanel
          title={selectedNode.label}
          headerContent={<NodeInspectorPanelTitle node={selectedNode} updateNode={onUpdateNode} />}
          closeLabel="Close node inspector"
          onClose={onCloseInspector}
          className="absolute bottom-4 right-4 top-[58px] z-30 w-[380px]"
        >
          <div className="h-full overflow-hidden">
            <NodeInspector
              workflow={workflow}
              workflowId={workflowId}
              selectedNode={selectedNode}
              debugState={debugState}
              nodeStates={nodeStates}
              showDevModelProviders={showDevModelProviders}
              updateNode={onUpdateNode}
            />
          </div>
        </FloatingPanel>
      )}

    </main>
  );
}
