import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { MessageSquareText, Search } from "lucide-react";
import type { AvailableVariableField, AvailableVariableGroup } from "@ai-agent-workflow/workflow-domain";
import { workflowNodeIcons } from "./workflowNodes/workflowNodeVisuals";

type FlatRow =
  | { kind: "header"; group: AvailableVariableGroup }
  | { kind: "field"; group: AvailableVariableGroup; field: AvailableVariableField; selectableIndex: number };

function matches(group: AvailableVariableGroup, field: AvailableVariableField, query: string): boolean {
  if (!query) {
    return true;
  }
  const needle = query.toLowerCase();
  return (
    field.name.toLowerCase().includes(needle) ||
    field.path.join(".").toLowerCase().includes(needle) ||
    group.nodeLabel.toLowerCase().includes(needle)
  );
}

/**
 * Searchable, keyboard-navigable list of Available Variables grouped by producing
 * node. Shared by the If/Else variable picker (with its own search box) and,
 * later, the rich-text `/` typeahead. Selecting a field calls `onSelect` with its
 * canonical `{{nodeId.path}}` reference. Array-of-object headers render but are
 * not selectable.
 */
export function VariablePicker({
  groups,
  onSelect,
  autoFocus = true,
  emptyHint = "没有可用的上游变量",
}: {
  groups: AvailableVariableGroup[];
  onSelect: (reference: string) => void;
  autoFocus?: boolean;
  emptyHint?: string;
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const { rows, selectableCount } = useMemo(() => {
    const out: FlatRow[] = [];
    let selectable = 0;
    for (const group of groups) {
      const visible = group.fields.filter((field) => matches(group, field, query));
      if (visible.length === 0) {
        continue;
      }
      out.push({ kind: "header", group });
      for (const field of visible) {
        out.push({
          kind: "field",
          group,
          field,
          selectableIndex: field.selectable ? selectable++ : -1,
        });
      }
    }
    return { rows: out, selectableCount: selectable };
  }, [groups, query]);

  // Clamp the highlight whenever the filtered set changes.
  useEffect(() => {
    setActiveIndex((current) => (selectableCount === 0 ? 0 : Math.min(current, selectableCount - 1)));
  }, [selectableCount, query]);

  const selectByIndex = (index: number) => {
    const row = rows.find((item) => item.kind === "field" && item.selectableIndex === index);
    if (row && row.kind === "field") {
      onSelect(row.field.reference);
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, Math.max(selectableCount - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter" || event.key === "Tab") {
      if (selectableCount > 0) {
        event.preventDefault();
        selectByIndex(activeIndex);
      }
    }
  };

  // Keep the active row scrolled into view.
  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-active="true"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, rows]);

  return (
    <div className="flex max-h-80 w-72 flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-2.5 py-2">
        <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <input
          autoFocus={autoFocus}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="搜索变量"
          aria-label="搜索变量"
          role="combobox"
          aria-expanded
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
        />
      </div>

      <div ref={listRef} role="listbox" className="min-h-0 flex-1 overflow-y-auto py-1">
        {rows.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">{query ? "无匹配变量" : emptyHint}</p>
        ) : (
          rows.map((row, index) => {
            if (row.kind === "header") {
              const NodeIcon = row.group.ambient ? MessageSquareText : workflowNodeIcons[row.group.nodeType];
              return (
                <div
                  key={`h-${row.group.nodeId}`}
                  role="group"
                  aria-label={row.group.nodeLabel}
                  className="flex items-center gap-1.5 px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  <NodeIcon className="size-3" aria-hidden />
                  <span className="truncate">{row.group.nodeLabel}</span>
                </div>
              );
            }

            const active = row.selectableIndex === activeIndex;
            const disabled = !row.field.selectable;
            return (
              <button
                key={`f-${row.field.reference}-${index}`}
                type="button"
                role="option"
                aria-selected={active}
                aria-disabled={disabled}
                data-active={active}
                disabled={disabled}
                onMouseMove={() => !disabled && setActiveIndex(row.selectableIndex)}
                onClick={() => !disabled && onSelect(row.field.reference)}
                className={[
                  "flex w-full items-center gap-2 px-2.5 py-1.5 text-left",
                  disabled ? "cursor-default opacity-50" : "cursor-pointer",
                  active && !disabled ? "bg-muted" : "",
                ].join(" ")}
              >
                <span className="shrink-0 font-mono text-[10px] font-semibold text-blue-500">{"{x}"}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">{row.field.path.join(".")}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{row.field.type}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
