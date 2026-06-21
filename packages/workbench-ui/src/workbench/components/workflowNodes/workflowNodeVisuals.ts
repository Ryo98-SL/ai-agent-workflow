import {
  Bot,
  Boxes,
  Braces,
  Brain,
  Clock,
  Cloud,
  Database,
  Flag,
  GitBranch,
  Globe,
  Mail,
  Play,
  Plug,
  Server,
  Sparkles,
  Terminal,
  TextCursorInput,
  UserCheck,
  Wrench,
  Zap,
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
  // MCP server / generic provider icons — shared so the picker, the server list,
  // and tool descriptors all resolve the same keys (see MCP_SERVER_ICON_KEYS).
  plug: Plug,
  server: Server,
  globe: Globe,
  cloud: Cloud,
  database: Database,
  bot: Bot,
  zap: Zap,
  sparkles: Sparkles,
  terminal: Terminal,
  boxes: Boxes,
};

export function resolveToolIcon(key?: string): LucideIcon {
  return (key && toolIcons[key]) || Wrench;
}

/** Curated, ordered icon keys offered when picking an MCP server icon. */
export const MCP_SERVER_ICON_KEYS = [
  "plug",
  "server",
  "globe",
  "cloud",
  "database",
  "bot",
  "zap",
  "sparkles",
  "terminal",
  "boxes",
  "wrench",
  "mail",
] as const;

export const DEFAULT_MCP_SERVER_ICON = "plug";
