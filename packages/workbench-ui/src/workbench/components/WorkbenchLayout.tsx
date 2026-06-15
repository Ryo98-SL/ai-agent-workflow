import { useState } from "react";
import { Database, Loader2, Play, Plus, Server, Settings } from "lucide-react";
import type {
  MemorySummarySettings,
  ModelProvider,
  ModelProviderKeys,
  OpenAICompatibleSettings,
  ProviderKeyPreference,
  WorkflowFile,
  WorkflowMode,
  WorkflowNode,
  WorkflowNodeType,
} from "@ai-agent-workflow/workflow-domain";
import type { ResumeRunRequest, RunInput } from "@ai-agent-workflow/api-contracts";
import { Button } from "./Button";
import { DebugPanel } from "./DebugPanel";
import { FloatingPanel } from "./FloatingPanel";
import { ModelSettingsPanel } from "./ModelSettingsPanel";
import { NodeInspector, NodeInspectorPanelTitle } from "./NodeInspector";
import { KnowledgeBasesDialog } from "./knowledge/KnowledgeBasesDialog";
import { McpServersDialog } from "./mcp/McpServersDialog";
import { NodePalette } from "./NodePalette";
import { Popover } from "./Popover";
import { ProjectFileActions } from "./ProjectFileActions";
import { ThemeMenu } from "../../theme/ThemeMenu";
import { AuthMenu } from "../../auth/AuthMenu";
import { RunHistoryMenu } from "./RunHistoryMenu";
import { WorkflowSwitcher } from "./WorkflowSwitcher";
import { useResizableWidth } from "../hooks/useResizableWidth";
import { WorkflowSwitchBar } from "./WorkflowSwitchBar";
import type { WorkflowMetaPatch } from "./WorkflowMetaEditor";
import { WorkflowCanvas } from "./WorkflowCanvas";
import type { WorkflowGraphHistoryEntry } from "../hooks/useWorkflowGraphHistory";
import type { AddNodeOptions, ChatTurn, DebugState, NodeExecutionState, ToolIdentity, WorkflowNodeActionHandler } from "../types";

type WorkbenchLayoutProps = {
  workflow: WorkflowFile;
  workflowId?: string;
  dirty: boolean;
  selectedNode?: WorkflowNode;
  selectedNodeId: string;
  debugState: DebugState;
  nodeStates: Map<string, NodeExecutionState>;
  paletteOpen: boolean;
  settingsOpen: boolean;
  inspectorOpen: boolean;
  debugOpen: boolean;
  debugView: "input" | "run";
  onDebugViewChange: (view: "input" | "run") => void;
  showDevModelProviders: boolean;
  canRedo: boolean;
  canUndo: boolean;
  onAddNode: (type: WorkflowNodeType, options?: AddNodeOptions) => void;
  placementNodeType: WorkflowNodeType | null;
  onBeginNodePlacement: (type: WorkflowNodeType, tool?: ToolIdentity) => void;
  onConfirmNodePlacement: (position: { x: number; y: number }) => void;
  onCancelNodePlacement: () => void;
  onCloseDebug: () => void;
  onCloseInspector: () => void;
  onClosePalette: () => void;
  onCloseSettings: () => void;
  onCommitGraphHistoryEntry: (entry: WorkflowGraphHistoryEntry) => void;
  onRedo: () => void;
  onToggleRunPanel: () => void;
  onRunWorkflow: (input: RunInput) => void;
  onResumeRun: (runId: string, request: ResumeRunRequest) => void;
  onNewConversation: () => void;
  conversationTurns: number;
  transcript: ChatTurn[];
  onSendChatMessage: (query: string, baseInput: Record<string, string>) => void;
  onSetWorkflowMode: (mode: WorkflowMode) => void;
  onMemorySummaryChange: (summary: MemorySummarySettings) => void;
  onSwitchWorkflow: (id: string, name: string) => void;
  pendingSwitchName?: string | null;
  switching: boolean;
  onConfirmSwitch: () => void;
  onCancelSwitch: () => void;
  onCreateWorkflow: () => void;
  onDeleteWorkflow: (id: string) => void;
  onSaveWorkflowMeta: (id: string, patch: WorkflowMetaPatch) => Promise<boolean>;
  onSaveWorkflow: () => void;
  onNodeAction: WorkflowNodeActionHandler;
  onSelectNode: (nodeId: string) => void;
  onTogglePalette: () => void;
  onToggleSettings: () => void;
  onUndo: () => void;
  onUpdateModelSettings: (settings: OpenAICompatibleSettings, providerKeys: ModelProviderKeys) => void;
  onUpdateProviderKeyPreference: (provider: ModelProvider, preference: ProviderKeyPreference) => void;
  onUpdateNode: (nodeId: string, updater: (node: WorkflowNode) => WorkflowNode) => void;
};

export function WorkbenchLayout({
  workflow,
  workflowId,
  dirty,
  selectedNode,
  selectedNodeId,
  debugState,
  nodeStates,
  paletteOpen,
  settingsOpen,
  inspectorOpen,
  debugOpen,
  debugView,
  onDebugViewChange,
  showDevModelProviders,
  canRedo,
  canUndo,
  onAddNode,
  placementNodeType,
  onBeginNodePlacement,
  onConfirmNodePlacement,
  onCancelNodePlacement,
  onCloseDebug,
  onCloseInspector,
  onClosePalette,
  onCloseSettings,
  onCommitGraphHistoryEntry,
  onRedo,
  onToggleRunPanel,
  onRunWorkflow,
  onResumeRun,
  onNewConversation,
  conversationTurns,
  transcript,
  onSendChatMessage,
  onSetWorkflowMode,
  onMemorySummaryChange,
  onSwitchWorkflow,
  pendingSwitchName,
  switching,
  onConfirmSwitch,
  onCancelSwitch,
  onCreateWorkflow,
  onDeleteWorkflow,
  onSaveWorkflowMeta,
  onSaveWorkflow,
  onNodeAction,
  onSelectNode,
  onTogglePalette,
  onToggleSettings,
  onUndo,
  onUpdateModelSettings,
  onUpdateProviderKeyPreference,
  onUpdateNode,
}: WorkbenchLayoutProps) {
  const hasStartNode = workflow.graph.nodes.some((node) => node.type === "start");
  const [knowledgeBasesOpen, setKnowledgeBasesOpen] = useState(false);
  const [mcpServersOpen, setMcpServersOpen] = useState(false);
  const inspectorResize = useResizableWidth({
    storageKey: "workbench:inspectorWidth",
    defaultWidth: 380,
    min: 340,
    max: 720,
    edge: "left",
  });

  return (
    <main className="relative h-full min-h-0 flex flex-col overflow-hidden bg-background text-foreground">
      {pendingSwitchName != null && (
        <WorkflowSwitchBar
          targetName={pendingSwitchName}
          busy={switching}
          onSaveAndSwitch={onConfirmSwitch}
          onCancel={onCancelSwitch}
        />
      )}
      <header className="z-30 flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card/95 px-4 shadow-sm backdrop-blur">
        <WorkflowSwitcher
          workflow={workflow}
          workflowId={workflowId}
          dirty={dirty}
          onSwitch={onSwitchWorkflow}
          onCreate={onCreateWorkflow}
          onDelete={onDeleteWorkflow}
          onSaveMeta={onSaveWorkflowMeta}
        />
        <div className="min-w-0 flex-1" />
        <ProjectFileActions dirty={dirty} filePath={workflowId} onSave={onSaveWorkflow} />
        <RunHistoryMenu workflow={workflow} workflowId={workflowId} debugState={debugState} nodeStates={nodeStates} />
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
                providerKeyPrefs={workflow.settings.providerKeyPrefs}
                showDevModelProviders={showDevModelProviders}
                onChange={onUpdateModelSettings}
                onProviderKeyPreferenceChange={onUpdateProviderKeyPreference}
            />
            <div className="mt-4 border-t border-border p-2">
              <Button
                variant="secondary"
                size="md"
                fullWidth
                className={`!border-none !rounded-none !shadow-none`}
                onClick={() => setKnowledgeBasesOpen(true)}
              >
                <Database size={15} aria-hidden />
                Knowledge Bases
              </Button>
              <Button
                variant="secondary"
                size="md"
                fullWidth
                className={`!border-none !rounded-none !shadow-none`}
                onClick={() => setMcpServersOpen(true)}
              >
                <Server size={15} aria-hidden />
                MCP Servers
              </Button>
            </div>
          </FloatingPanel>
        </Popover>
        <KnowledgeBasesDialog open={knowledgeBasesOpen} onOpenChange={setKnowledgeBasesOpen} />
        <McpServersDialog open={mcpServersOpen} onOpenChange={setMcpServersOpen} />
      </header>

      <section className=" flex-1 relative h-full ">
        <WorkflowCanvas
          workflow={workflow}
          selectedNodeId={selectedNodeId}
          nodeStates={nodeStates}
          waitingNodeId={debugState.status === "waiting" ? debugState.waiting?.interrupt.nodeId : undefined}
          canRedo={canRedo}
          canUndo={canUndo}
          onAddNode={onAddNode}
          placementNodeType={placementNodeType}
          onConfirmPlacement={onConfirmNodePlacement}
          onCancelPlacement={onCancelNodePlacement}
          onClearSelection={onCloseInspector}
          onCommitGraphHistoryEntry={onCommitGraphHistoryEntry}
          onNodeAction={onNodeAction}
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
              <NodePalette hasStartNode={hasStartNode} onAddNode={onBeginNodePlacement} />
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
                disabled={!hasStartNode}
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
              className="h-full w-[560px]"
            >
              <div className="h-full overflow-hidden">
                <DebugPanel
                  workflow={workflow}
                  debugState={debugState}
                  nodeStates={nodeStates}
                  onRun={onRunWorkflow}
                  onResumeRun={onResumeRun}
                  onNewConversation={onNewConversation}
                  conversationTurns={conversationTurns}
                  transcript={transcript}
                  onSendMessage={onSendChatMessage}
                  onMemorySummaryChange={onMemorySummaryChange}
                  onSetMode={onSetWorkflowMode}
                  view={debugView}
                  onViewChange={onDebugViewChange}
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
          className="absolute bottom-4 right-4 top-[58px] z-30"
          style={{ width: inspectorResize.width }}
          resizeHandle={
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize inspector"
              onPointerDown={inspectorResize.onPointerDown}
              className="group absolute inset-y-0 left-0 z-10 flex w-2.5 cursor-ew-resize touch-none items-center justify-start"
            >
              <span
                className={[
                  "my-auto h-10 w-1 rounded-full transition-colors",
                  inspectorResize.isDragging ? "bg-brand" : "bg-border group-hover:bg-brand/60",
                ].join(" ")}
              />
            </div>
          }
        >
          <div className="h-full overflow-hidden">
            <NodeInspector
              workflow={workflow}
              workflowId={workflowId}
              selectedNode={selectedNode}
              debugState={debugState}
              nodeStates={nodeStates}
              showDevModelProviders={showDevModelProviders}
              onOpenKnowledgeBases={() => setKnowledgeBasesOpen(true)}
              onOpenMcpServers={() => setMcpServersOpen(true)}
              onProviderKeyPreferenceChange={onUpdateProviderKeyPreference}
              onResumeRun={onResumeRun}
              updateNode={onUpdateNode}
            />
          </div>
        </FloatingPanel>
      )}

    </main>
  );
}
