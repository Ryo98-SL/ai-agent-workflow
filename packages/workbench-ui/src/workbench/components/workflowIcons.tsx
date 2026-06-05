import {
  Bot,
  Brain,
  Code,
  Database,
  FilePlus2,
  FileText,
  GitPullRequest,
  type LucideIcon,
  Mail,
  MessageSquare,
  Search,
  Sparkles,
  Workflow,
  Zap,
} from "lucide-react";

/** Curated icon set a user can assign to a workflow (stored as the key). */
export const WORKFLOW_ICONS: Record<string, LucideIcon> = {
  workflow: Workflow,
  bot: Bot,
  chat: MessageSquare,
  doc: FileText,
  pr: GitPullRequest,
  sparkles: Sparkles,
  brain: Brain,
  zap: Zap,
  search: Search,
  db: Database,
  mail: Mail,
  code: Code,
};

export const WORKFLOW_ICON_KEYS = Object.keys(WORKFLOW_ICONS);

export const DEFAULT_WORKFLOW_ICON = "workflow";

export function WorkflowIconGlyph({ icon, size = 16 }: { icon?: string; size?: number }) {
  const Cmp = (icon && WORKFLOW_ICONS[icon]) || WORKFLOW_ICONS[DEFAULT_WORKFLOW_ICON] || FilePlus2;
  return <Cmp size={size} aria-hidden />;
}
