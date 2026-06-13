import { useMemo, useState } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { TOOL_DESCRIPTORS, type ToolDescriptor } from "@ai-agent-workflow/workflow-domain";
import { resolveToolIcon } from "../workflowNodes/workflowNodeVisuals";

/**
 * Dify-style Tool Browser (CONTEXT.md — Tool Browser). Lists Tool Registry entries
 * so the user can pick which tool to add/rebind. Only `builtin` tools exist today;
 * the Plugin / Custom / Workflow / MCP tabs are reserved placeholders. There is no
 * marketplace chrome (featured / install counts) by design.
 */
const TABS = [
  { id: "all", label: "All" },
  { id: "plugin", label: "Plugin" },
  { id: "custom", label: "Custom" },
  { id: "workflow", label: "Workflow" },
  { id: "mcp", label: "MCP" },
] as const;
type TabId = (typeof TABS)[number]["id"];

type ToolBrowserProps = {
  onSelect: (descriptor: ToolDescriptor) => void;
  /** Back to the node palette (shown in the add-node flow, omitted when rebinding). */
  onBack?: () => void;
  /** Highlights the currently-bound tool (rebind flow). */
  selectedKey?: string;
};

function descriptorKey(descriptor: ToolDescriptor): string {
  return `${descriptor.provider}:${descriptor.providerId}:${descriptor.toolName}`;
}

export function ToolBrowser({ onSelect, onBack, selectedKey }: ToolBrowserProps) {
  const [tab, setTab] = useState<TabId>("all");
  const [query, setQuery] = useState("");

  const tools = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return TOOL_DESCRIPTORS.filter((descriptor) => {
      const matchesTab = tab === "all" || descriptor.category === tab;
      const matchesQuery =
        needle === "" ||
        descriptor.label.toLowerCase().includes(needle) ||
        descriptor.toolName.toLowerCase().includes(needle);
      return matchesTab && matchesQuery;
    });
  }, [tab, query]);

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 space-y-2 border-b border-border p-2.5">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to node palette"
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ArrowLeft size={15} aria-hidden />
            </button>
          )}
          <div className="flex flex-1 items-center gap-2 rounded-md border border-input px-2.5 py-1.5">
            <Search size={14} className="shrink-0 text-muted-foreground" aria-hidden />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索工具"
              aria-label="搜索工具"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
          </div>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={[
                "shrink-0 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                tab === item.id ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {tools.length === 0 ? (
          <p className="px-3 py-10 text-center text-xs text-muted-foreground">{query ? "无匹配工具" : "敬请期待"}</p>
        ) : (
          tools.map((descriptor) => {
            const Icon = resolveToolIcon(descriptor.icon);
            const key = descriptorKey(descriptor);
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelect(descriptor)}
                className={[
                  "flex w-full items-center gap-2.5 rounded-md p-2 text-left transition-colors hover:bg-accent",
                  key === selectedKey ? "bg-accent" : "",
                ].join(" ")}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-amber-700 text-white">
                  <Icon size={16} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{descriptor.label}</span>
                  {descriptor.description && (
                    <span className="block truncate text-xs text-muted-foreground">{descriptor.description}</span>
                  )}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
