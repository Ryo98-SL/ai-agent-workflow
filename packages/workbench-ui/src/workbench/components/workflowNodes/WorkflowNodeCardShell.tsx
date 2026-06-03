import type { MouseEvent, PointerEvent, ReactNode } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { WorkflowNode, WorkflowNodeType } from "@ai-agent-workflow/workflow-domain";
import { type LucideIcon, Plus } from "lucide-react";
import type { WorkflowNodePaletteHandleType } from "../../types";
import { getWorkflowNodeCardClassName } from "./workflowNodeLayout";
import { workflowNodeIconBackgroundClassNames, workflowNodeIconClassName } from "./workflowNodeVisuals";

const handleClassName = "!size-4 !top-5 group !bg-transparent !border-none";

export type OpenWorkflowNodePalette = (
  sourceNode: WorkflowNode,
  handleType: WorkflowNodePaletteHandleType,
  anchorElement: HTMLElement,
) => void;
export type WorkflowReactNode = Node<{ node: WorkflowNode; onOpenNodePalette?: OpenWorkflowNodePalette }, WorkflowNodeType>;
export type WorkflowNodeProps = NodeProps<WorkflowReactNode>;

type WorkflowNodeCardShellProps = WorkflowNodeProps & {
  Icon: LucideIcon;
  children?: ReactNode;
  noSourceHandle?: boolean;
  noTargetHandle?: boolean;
};

export function WorkflowNodeCardShell({ children, noSourceHandle, noTargetHandle, data, selected, Icon }: WorkflowNodeCardShellProps) {
  const node = data.node;
  const openNodePalette = (handleType: WorkflowNodePaletteHandleType, anchorElement: HTMLElement) => {
    data.onOpenNodePalette?.(node, handleType, anchorElement);
  };

  return (
    <div
      className={[
        getWorkflowNodeCardClassName(node.type),
        selected ? "border-emerald-500 ring-2 ring-emerald-100" : "border-slate-200",
      ].join(" ")}
      title={node.label}
    >
      {!noTargetHandle && (
        <Handle type="target" position={Position.Left} className={handleClassName}>
          <PlusNode label={`Add connected node into ${node.label}`} onClick={(anchor) => openNodePalette("target", anchor)} />
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

      {children ?? <p className="mt-1 text-xs uppercase text-slate-500">{node.type}</p>}
      {!noSourceHandle && (
        <Handle type="source" position={Position.Right} className={handleClassName}>
          <PlusNode label={`Add connected node from ${node.label}`} onClick={(anchor) => openNodePalette("source", anchor)} />
          <InnerHandle />
        </Handle>
      )}
    </div>
  );
}
function InnerHandle() {
  return <span className="absolute left-1/2 top-1/2 h-2 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-green-500" />;
}
function PlusNode({ label, onClick }: { label: string; onClick: (anchorElement: HTMLElement) => void }) {
  const stopHandleGesture = (event: MouseEvent<HTMLButtonElement> | PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onPointerDown={stopHandleGesture}
      onMouseDown={stopHandleGesture}
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
