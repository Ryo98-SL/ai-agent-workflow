import {
  Braces,
  Brain,
  Clock,
  Database,
  Flag,
  GitBranch,
  Play,
  TextCursorInput,
  type LucideIcon,
} from "lucide-react";
import type { WorkflowNodeType } from "@ai-agent-workflow/workflow-domain";

export const workflowNodeIconBackgroundClassNames = {
  start: "bg-emerald-700",
  llm: "bg-violet-700",
  knowledge: "bg-sky-700",
  tool: "bg-amber-700",
  code: "bg-slate-700",
  ifElse: "bg-blue-700",
  template: "bg-rose-700",
  end: "bg-red-700",
} satisfies Record<WorkflowNodeType, string>;

export const workflowNodeIcons = {
  start: Play,
  llm: Brain,
  knowledge: Database,
  tool: Clock,
  code: Braces,
  ifElse: GitBranch,
  template: TextCursorInput,
  end: Flag,
} satisfies Record<WorkflowNodeType, LucideIcon>;

export const workflowNodeIconClassName = "text-white";
