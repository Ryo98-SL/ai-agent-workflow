import type { WorkflowNodeType } from "@ai-agent-workflow/workflow-domain";
import { workflowNodeIconBackgroundClassNames, workflowNodeIcons } from "./workflowNodes/workflowNodeVisuals";

type NodeTypeIconProps = {
  type: WorkflowNodeType;
  /** Badge edge length in pixels. */
  size?: number;
  /** Inner lucide icon size in pixels. */
  iconSize?: number;
  className?: string;
};

/**
 * Colored square badge with the lucide icon for a workflow node type. Shared by
 * the debug run cards and the node inspector header so node identity reads the
 * same everywhere.
 */
export function NodeTypeIcon({ type, size = 20, iconSize = 12, className = "" }: NodeTypeIconProps) {
  const Icon = workflowNodeIcons[type] ?? workflowNodeIcons.code;

  return (
    <span
      className={[
        "flex shrink-0 items-center justify-center rounded text-white",
        workflowNodeIconBackgroundClassNames[type] ?? "bg-slate-700",
        className,
      ].join(" ")}
      style={{ width: size, height: size }}
    >
      <Icon size={iconSize} aria-hidden />
    </span>
  );
}
