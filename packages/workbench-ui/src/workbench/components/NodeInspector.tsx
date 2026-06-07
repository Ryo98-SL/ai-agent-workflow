import { useEffect, useState } from "react";
import type { ModelProvider, ProviderKeyPreference, WorkflowFile, WorkflowNode } from "@ai-agent-workflow/workflow-domain";
import type { DebugState, NodeExecutionState } from "../types";
import { LLMInspector } from "./inspectors/LLMInspector";
import { StartInspector } from "./inspectors/StartInspector";
import { ToolInspector } from "./inspectors/ToolInspector";
import { UnsupportedInspector } from "./inspectors/UnsupportedInspector";
import { NodeRunList } from "./NodeRunList";
import { NodeTypeIcon } from "./NodeTypeIcon";

type NodeInspectorProps = {
  workflow: WorkflowFile;
  workflowId?: string;
  selectedNode?: WorkflowNode;
  debugState: DebugState;
  nodeStates: Map<string, NodeExecutionState>;
  showDevModelProviders?: boolean;
  onProviderKeyPreferenceChange?: (provider: ModelProvider, preference: ProviderKeyPreference) => void;
  updateNode: (nodeId: string, updater: (node: WorkflowNode) => WorkflowNode) => void;
};

type NodeInspectorPanelTitleProps = {
  node: WorkflowNode;
  updateNode: (nodeId: string, updater: (node: WorkflowNode) => WorkflowNode) => void;
};

type InspectorTab = "settings" | "history";

export function NodeInspectorPanelTitle({ node, updateNode }: NodeInspectorPanelTitleProps) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <NodeTypeIcon type={node.type} size={32} iconSize={18} className="rounded-md" />
      <input
        aria-label="Node label"
        value={node.label}
        onChange={(event) => updateNode(node.id, (current) => ({ ...current, label: event.target.value }))}
        className="min-w-0 flex-1 truncate border-0 bg-transparent p-0 text-lg font-semibold leading-8 text-foreground outline-none placeholder:text-muted-foreground focus:ring-0"
        placeholder="Untitled node"
      />
    </div>
  );
}

export function NodeInspector({
  workflow,
  workflowId,
  selectedNode,
  debugState,
  nodeStates,
  showDevModelProviders = false,
  onProviderKeyPreferenceChange,
  updateNode,
}: NodeInspectorProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>("settings");

  useEffect(() => {
    setActiveTab("settings");
  }, [selectedNode?.id]);

  useEffect(() => {
    if (debugState.status === "running") {
      setActiveTab("history");
    }
  }, [debugState.status, selectedNode?.id]);

  if (!selectedNode) {
    return (
      <section className="p-4">
        <h2 className="text-sm font-semibold">Inspector</h2>
        <p className="mt-2 text-sm text-muted-foreground">Select a node to configure it.</p>
      </section>
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-4 py-4">
        <textarea
          aria-label="Node description"
          value={selectedNode.description || ""}
          onChange={(event) =>
            updateNode(selectedNode.id, (current) => ({ ...current, description: event.target.value || undefined }))
          }
          placeholder="Add description..."
          rows={2}
          className="block min-h-14 w-full resize-none border-0 bg-transparent p-0 text-sm leading-6 text-muted-foreground outline-none placeholder:text-muted-foreground/70 focus:text-foreground focus:ring-0"
        />
      </div>

      <div className="flex shrink-0 items-end gap-6 border-b border-border px-4">
        <InspectorTabButton
          active={activeTab === "settings"}
          disabled={debugState.status === "running"}
          onClick={() => setActiveTab("settings")}
        >
          Settings
        </InspectorTabButton>
        <InspectorTabButton active={activeTab === "history"} onClick={() => setActiveTab("history")}>
          History
        </InspectorTabButton>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {activeTab === "settings" ? (
          selectedNode.type === "start" ? (
            <StartInspector node={selectedNode} updateNode={updateNode} />
          ) : selectedNode.type === "llm" ? (
            <LLMInspector
              workflow={workflow}
              node={selectedNode}
              showDevModelProviders={showDevModelProviders}
              onProviderKeyPreferenceChange={onProviderKeyPreferenceChange}
              updateNode={updateNode}
            />
          ) : selectedNode.type === "tool" ? (
            <ToolInspector node={selectedNode} updateNode={updateNode} />
          ) : (
            <UnsupportedInspector node={selectedNode} updateNode={updateNode} />
          )
        ) : (
          <NodeRunList
            workflow={workflow}
            workflowId={workflowId}
            node={selectedNode}
            debugState={debugState}
            nodeStates={nodeStates}
          />
        )}
      </div>
    </section>
  );
}

function InspectorTabButton({
  active,
  children,
  disabled = false,
  onClick,
}: {
  active: boolean;
  children: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={[
        "border-b-2 px-0 pb-2 pt-1 text-sm font-semibold uppercase tracking-wide transition-colors",
        active
          ? "border-brand text-foreground"
          : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
        disabled ? "cursor-not-allowed opacity-45 hover:border-transparent hover:text-muted-foreground" : "",
      ].join(" ")}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
