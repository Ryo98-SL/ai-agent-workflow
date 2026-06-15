import {
  Bot,
  Braces,
  Brain,
  Clock,
  Database,
  Flag,
  GitBranch,
  Mail,
  Play,
  TextCursorInput,
  UserCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { WorkflowNodeType } from "@ai-agent-workflow/workflow-domain";

export const workflowNodeIconBackgroundClassNames = {
  start: "bg-emerald-700",
  llm: "bg-violet-700",
  agent: "bg-indigo-700",
  knowledge: "bg-sky-700",
  tool: "bg-amber-700",
  code: "bg-slate-700",
  ifElse: "bg-blue-700",
  humanInput: "bg-teal-700",
  template: "bg-rose-700",
  end: "bg-red-700",
} satisfies Record<WorkflowNodeType, string>;

export const workflowNodeIcons = {
  start: Play,
  llm: Brain,
  agent: Bot,
  knowledge: Database,
  tool: Wrench,
  code: Braces,
  ifElse: GitBranch,
  humanInput: UserCheck,
  template: TextCursorInput,
  end: Flag,
} satisfies Record<WorkflowNodeType, LucideIcon>;

export const workflowNodeIconClassName = "text-white";

/**
 * lucide components for a Tool Descriptor's `icon` key (ADR 0003). All tools share
 * the `tool` node type, so per-tool identity is resolved from the descriptor's icon
 * key rather than the type-keyed `workflowNodeIcons` table. Unknown keys fall back
 * to the generic wrench.
 */
export const toolIcons: Record<string, LucideIcon> = {
  clock: Clock,
  mail: Mail,
  wrench: Wrench,
};

export function resolveToolIcon(key?: string): LucideIcon {
  return (key && toolIcons[key]) || Wrench;
}
