import type { LucideIcon } from "lucide-react";
import type { WorkflowNodeType } from "@ai-agent-workflow/workflow-domain";
import { workflowNodeIconBackgroundClassNames, workflowNodeIcons } from "./workflowNodes/workflowNodeVisuals";

type NodeTypeIconProps = {
  type: WorkflowNodeType;
  /** Badge edge length in pixels. */
  size?: number;
  /** Inner lucide icon size in pixels. */
  iconSize?: number;
  className?: string;
  /**
   * Overrides the type-keyed icon. Used for Tool nodes, whose identity is per-tool
   * (resolved from the bound descriptor) rather than per node type.
   */
  icon?: LucideIcon;
};

/**
 * Colored square badge with the lucide icon for a workflow node type. Shared by
 * the debug run cards and the node inspector header so node identity reads the
 * same everywhere. Pass `icon` to override (e.g. a Tool node's per-tool icon).
 */
export function NodeTypeIcon({ type, size = 20, iconSize = 12, className = "", icon }: NodeTypeIconProps) {
  const Icon = icon ?? workflowNodeIcons[type] ?? workflowNodeIcons.code;

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
