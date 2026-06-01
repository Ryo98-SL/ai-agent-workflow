import { Brain, Braces, Clock, Database, Flag, GitBranch, Play, TextCursorInput, type LucideIcon } from "lucide-react";
import type { WorkflowNodeType } from "@ai-agent-workflow/workflow-domain";

type PaletteItem = {
  type: WorkflowNodeType;
  label: string;
  description: string;
  group: string;
  icon: LucideIcon;
};

const items: PaletteItem[] = [
  { type: "start", label: "Start", description: "Graph entry marker", group: "Basic", icon: Play },
  { type: "end", label: "End", description: "Graph exit marker", group: "Basic", icon: Flag },
  { type: "llm", label: "LLM", description: "Executable chat debug node", group: "AI", icon: Brain },
  { type: "knowledge", label: "Knowledge", description: "Schema placeholder", group: "AI", icon: Database },
  { type: "tool", label: "Current Time", description: "Executable built-in tool", group: "Tools", icon: Clock },
  { type: "code", label: "Code", description: "Future runtime", group: "Tools", icon: Braces },
  { type: "ifElse", label: "If/Else", description: "Future branching", group: "Logic", icon: GitBranch },
  { type: "template", label: "Template", description: "Future text transform", group: "Logic", icon: TextCursorInput },
];

export function NodePalette({ onAddNode }: { onAddNode: (type: WorkflowNodeType) => void }) {
  const groups = [...new Set(items.map((item) => item.group))];

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-3">
        {groups.map((group) => (
          <section key={group} className="mb-5">
            <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{group}</h3>
            <div className="space-y-2">
              {items
                .filter((item) => item.group === group)
                .map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => onAddNode(item.type)}
                    className="flex w-full items-center gap-3 rounded-md border border-slate-200 bg-white p-3 text-left hover:border-emerald-300 hover:bg-emerald-50"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                      <item.icon size={17} aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{item.label}</span>
                      <span className="block truncate text-xs text-slate-500">{item.description}</span>
                    </span>
                  </button>
                ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
