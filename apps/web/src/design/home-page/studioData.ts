import {
  Bot,
  FileInput,
  FilePlus2,
  GitBranch,
  LayoutGrid,
  MessageSquare,
  PanelTop,
  Plus,
  type LucideIcon,
} from "lucide-react";

export type StudioAppType = "Workflow" | "Chatflow" | "Chatbot" | "Agent" | "Completion";

export type StudioApp = {
  id: string;
  name: string;
  owner: string;
  editedAt: string;
  type: StudioAppType;
  icon: LucideIcon;
  accent: string;
};

export type StudioCategory = {
  label: "All" | StudioAppType;
  icon: LucideIcon;
  active?: boolean;
};

export type CreateAction = {
  label: string;
  icon: LucideIcon;
};

export const studioCategories: StudioCategory[] = [
  { label: "All", icon: LayoutGrid, active: true },
  { label: "Workflow", icon: GitBranch },
  { label: "Chatflow", icon: MessageSquare },
  { label: "Chatbot", icon: Bot },
  { label: "Agent", icon: PanelTop },
  { label: "Completion", icon: FilePlus2 },
];

export const createActions: CreateAction[] = [
  { label: "Create from Blank", icon: Plus },
  { label: "Create from Template", icon: FilePlus2 },
  { label: "Import DSL file", icon: FileInput },
];

export const studioApps: StudioApp[] = [
  {
    id: "m1",
    name: "M1",
    owner: "Ryo",
    editedAt: "06/01/2026 20:42",
    type: "Agent",
    icon: Bot,
    accent: "bg-indigo-500",
  },
  {
    id: "content",
    name: "Multi-platform content generator",
    owner: "Ryo",
    editedAt: "06/01/2026 14:39",
    type: "Chatbot",
    icon: Bot,
    accent: "bg-sky-500",
  },
  {
    id: "demo",
    name: "Demo1",
    owner: "Ryo",
    editedAt: "05/31/2026 16:54",
    type: "Chatbot",
    icon: Bot,
    accent: "bg-sky-500",
  },
];
