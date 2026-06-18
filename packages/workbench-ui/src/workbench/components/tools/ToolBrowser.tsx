import { useMemo, useState } from "react";
import { ArrowLeft, Check, Search, Settings2 } from "lucide-react";
import { useTranslation } from "@ai-agent-workflow/i18n";
import { getToolDescriptors, toolDescriptorKey, type ToolDescriptor } from "@ai-agent-workflow/workflow-domain";
import { resolveToolIcon } from "../workflowNodes/workflowNodeVisuals";
import { localizedToolDescriptor } from "./localizedToolDescriptor";

/**
 * Dify-style Tool Browser (CONTEXT.md — Tool Browser). Lists Tool Registry entries
 * so the user can pick which tool to add/rebind, or — in multi-select mode — pick
 * several into an Agent's tool list. The MCP tab is populated from the client-only
 * descriptor registry ({@link getToolDescriptors}), kept in sync by `useMcpServers`.
 * The Plugin / Custom / Workflow tabs are reserved placeholders.
 */
const TABS = [
  { id: "all", labelKey: "tools.tabs.all" },
  { id: "builtin", labelKey: "tools.tabs.builtin" },
  { id: "mcp", labelKey: "tools.tabs.mcp" },
  { id: "plugin", labelKey: "tools.tabs.plugin" },
  { id: "custom", labelKey: "tools.tabs.custom" },
  { id: "workflow", labelKey: "tools.tabs.workflow" },
] as const;
type TabId = (typeof TABS)[number]["id"];

type ToolBrowserProps = {
  /** Single-select: pick one tool (add/rebind flows). */
  onSelect?: (descriptor: ToolDescriptor) => void;
  /** Back to the node palette (shown in the add-node flow, omitted when rebinding). */
  onBack?: () => void;
  /** Highlights the currently-bound tool (single-select rebind flow). */
  selectedKey?: string;
  /** Multi-select: the currently-selected tool keys (Agent tool list). */
  selectedKeys?: Set<string>;
  /** Multi-select: toggle a tool in/out of the list (keeps the browser open). */
  onToggle?: (descriptor: ToolDescriptor) => void;
  /** Opens the MCP server management dialog from the MCP tab. */
  onOpenMcpServers?: () => void;
};

export function ToolBrowser({ onSelect, onBack, selectedKey, selectedKeys, onToggle, onOpenMcpServers }: ToolBrowserProps) {
  const { t } = useTranslation("workbench");
  const [tab, setTab] = useState<TabId>("all");
  const [query, setQuery] = useState("");
  const multiSelect = Boolean(onToggle);

  const tools = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return getToolDescriptors().map((descriptor) => localizedToolDescriptor(descriptor, t)).filter((descriptor) => {
      const matchesTab = tab === "all" || descriptor.category === tab;
      const matchesQuery =
        needle === "" ||
        descriptor.label.toLowerCase().includes(needle) ||
        descriptor.toolName.toLowerCase().includes(needle);
      return matchesTab && matchesQuery;
    });
  }, [tab, query, t]);

  const isSelected = (key: string) => (multiSelect ? Boolean(selectedKeys?.has(key)) : key === selectedKey);
  const handlePick = (descriptor: ToolDescriptor) => (multiSelect ? onToggle?.(descriptor) : onSelect?.(descriptor));

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 space-y-2 border-b border-border p-2.5">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label={t("tools.back")}
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
              placeholder={t("tools.search")}
              aria-label={t("tools.search")}
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
              {t(item.labelKey)}
            </button>
          ))}
        </div>
        {tab === "mcp" && onOpenMcpServers && (
          <button
            type="button"
            onClick={onOpenMcpServers}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Settings2 size={13} aria-hidden />
            {t("tools.manageMcp")}
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {tools.length === 0 ? (
          <ToolBrowserEmpty tab={tab} hasQuery={Boolean(query)} onOpenMcpServers={onOpenMcpServers} />
        ) : (
          tools.map((descriptor) => {
            const Icon = resolveToolIcon(descriptor.icon);
            const key = toolDescriptorKey(descriptor.provider, descriptor.providerId, descriptor.toolName);
            const selected = isSelected(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => handlePick(descriptor)}
                aria-pressed={multiSelect ? selected : undefined}
                className={[
                  "flex w-full items-center gap-2.5 rounded-md p-2 text-left transition-colors hover:bg-accent",
                  selected ? "bg-accent" : "",
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
                {multiSelect && (
                  <span
                    className={[
                      "flex size-5 shrink-0 items-center justify-center rounded border",
                      selected ? "border-brand bg-brand text-brand-foreground" : "border-border",
                    ].join(" ")}
                    aria-hidden
                  >
                    {selected && <Check size={13} />}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function ToolBrowserEmpty({
  tab,
  hasQuery,
  onOpenMcpServers,
}: {
  tab: TabId;
  hasQuery: boolean;
  onOpenMcpServers?: () => void;
}) {
  const { t } = useTranslation("workbench");

  if (hasQuery) {
    return <p className="px-3 py-10 text-center text-xs text-muted-foreground">{t("tools.noMatches")}</p>;
  }
  if (tab === "mcp") {
    return (
      <div className="flex flex-col items-center gap-2 px-3 py-10 text-center">
        <p className="text-xs text-muted-foreground">{t("tools.noMcp")}</p>
        {onOpenMcpServers && (
          <button
            type="button"
            onClick={onOpenMcpServers}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Settings2 size={13} aria-hidden />
            {t("tools.manageMcp")}
          </button>
        )}
      </div>
    );
  }
  return <p className="px-3 py-10 text-center text-xs text-muted-foreground">{t("tools.comingSoon")}</p>;
}
