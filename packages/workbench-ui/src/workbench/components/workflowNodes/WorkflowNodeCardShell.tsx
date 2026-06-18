import type { ReactNode } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { ModelProvider, WorkflowNode, WorkflowNodeType } from "@ai-agent-workflow/workflow-domain";
import { AlertCircle, CheckCircle2, PauseCircle, type LucideIcon, Plus } from "lucide-react";
import { useTranslation } from "@ai-agent-workflow/i18n";
import type { WorkflowNodeActionHandler, WorkflowNodePaletteHandleType } from "../../types";
import { WORKBENCH_I18N_NAMESPACE } from "../../../i18n";
import { VariableText } from "../VariableTag";
import { WorkflowNodeActionsMenu } from "../WorkflowNodeActionsMenu";
import { getWorkflowNodeCardClassName } from "./workflowNodeLayout";
import { workflowNodeIconBackgroundClassNames, workflowNodeIconClassName } from "./workflowNodeVisuals";

export const workflowHandleClassName = "!size-4 !top-5 group !bg-transparent !border-none";
const handleClassName = workflowHandleClassName;

export type OpenWorkflowNodePalette = (
  sourceNode: WorkflowNode,
  handleType: WorkflowNodePaletteHandleType,
  anchorElement: HTMLElement,
  sourceHandleId?: string,
) => void;
export type WorkflowReactNode = Node<
  {
    node: WorkflowNode;
    activeModel?: string;
    activeModelProvider?: ModelProvider;
    onOpenNodePalette?: OpenWorkflowNodePalette;
    onNodeAction?: WorkflowNodeActionHandler;
    executionStatus?: "running" | "waiting" | "succeeded" | "failed";
  },
  WorkflowNodeType
>;
export type WorkflowNodeProps = NodeProps<WorkflowReactNode>;

type WorkflowNodeCardShellProps = WorkflowNodeProps & {
  Icon: LucideIcon;
  children?: ReactNode;
  noSourceHandle?: boolean;
  noTargetHandle?: boolean;
};

export function WorkflowNodeCardShell({ children, noSourceHandle, noTargetHandle, data, selected, Icon }: WorkflowNodeCardShellProps) {
  const { t } = useTranslation(WORKBENCH_I18N_NAMESPACE);
  const node = data.node;
  const executionStatus = data.executionStatus;
  const openNodePalette = (handleType: WorkflowNodePaletteHandleType, anchorElement: HTMLElement) => {
    data.onOpenNodePalette?.(node, handleType, anchorElement);
  };

  return (
    <div
      className={[
        "group/card",
        getWorkflowNodeCardClassName(node.type),
        selected ? "border-brand ring-2 ring-brand/20" : "border-border",
        executionStatus === "running" ? "ring-2 ring-brand animate-pulse" : "",
        executionStatus === "waiting" ? "ring-2 ring-amber-500" : "",
      ].join(" ")}
      title={node.label}
    >
      {node.type !== "start" && data.onNodeAction && (
        <WorkflowNodeActionsMenu node={node} selected={selected} onNodeAction={data.onNodeAction} />
      )}
      {executionStatus === "waiting" && (
        <PauseCircle
          size={15}
          className="absolute -right-1.5 -top-1.5 rounded-full bg-card text-amber-500"
          aria-label={t("workflowNodes.awaitingHumanInput", { defaultValue: "Awaiting human input" })}
        />
      )}
      {executionStatus === "succeeded" && (
        <CheckCircle2 size={14} className="absolute -right-1.5 -top-1.5 text-brand bg-card rounded-full" aria-hidden />
      )}
      {executionStatus === "failed" && (
        <AlertCircle size={14} className="absolute -right-1.5 -top-1.5 text-destructive bg-card rounded-full" aria-hidden />
      )}
      {!noTargetHandle && (
        <Handle type="target" position={Position.Left} className={handleClassName}>
          <PlusNode
            label={t("workflowNodes.addConnectedInto", {
              defaultValue: "Add connected node into {{label}}",
              label: node.label,
            })}
            onClick={(anchor) => openNodePalette("target", anchor)}
          />
          <InnerHandle />
        </Handle>
      )}
      <div className="flex items-center">
        <span
          className={[
            "flex size-6 shrink-0 items-center justify-center rounded-md",
            workflowNodeIconBackgroundClassNames[node.type],
            workflowNodeIconClassName,
          ].join(" ")}
        >
          <Icon size={12} aria-hidden />
        </span>

        <p className="ml-2 truncate text-sm font-semibold">{node.label}</p>
      </div>

      {children ?? (
        node.description && (
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            <VariableText text={node.description} />
          </p>
        )
      )}
      {!noSourceHandle && (
        <Handle type="source" position={Position.Right} className={handleClassName}>
          <PlusNode
            label={t("workflowNodes.addConnectedFrom", {
              defaultValue: "Add connected node from {{label}}",
              label: node.label,
            })}
            onClick={(anchor) => openNodePalette("source", anchor)}
          />
          <InnerHandle />
        </Handle>
      )}
    </div>
  );
}
export function InnerHandle() {
  return <span className="absolute left-1/2 top-1/2 h-2 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-green-500" />;
}
export function PlusNode({ label, onClick }: { label: string; onClick: (anchorElement: HTMLElement) => void }) {
  // We intentionally do NOT stop pointer/mouse down here: letting those events
  // bubble to the underlying ReactFlow Handle is what lets the user start an
  // edge-drag connection from this spot. A plain click (no drag) still fires
  // `onClick` below and opens the palette, while a drag to another handle
  // resolves as a connection (its pointerup lands elsewhere, so no click here).
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick(event.currentTarget.closest(".react-flow__handle") ?? event.currentTarget);
      }}
      className="nodrag nopan relative z-10 flex size-full scale-0 items-center justify-center rounded-full bg-green-500 transition group-hover:scale-100"
    >
      <Plus className="text-white" aria-hidden />
    </button>
  );
}
