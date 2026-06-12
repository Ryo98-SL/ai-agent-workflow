import { useState } from "react";
import { Copy, CopyPlus, MoreHorizontal, Trash2, type LucideIcon } from "lucide-react";
import type { WorkflowNode } from "@ai-agent-workflow/workflow-domain";
import type { WorkflowNodeActionHandler } from "../types";
import { Popover } from "./Popover";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform ?? "");
const MOD = isMac ? "⌘" : "Ctrl+";

type WorkflowNodeActionsMenuProps = {
  node: WorkflowNode;
  /** True when the node is selected/activated — keeps the trigger visible. */
  selected?: boolean;
  onNodeAction: WorkflowNodeActionHandler;
};

/**
 * Dify-style three-dot actions button that floats above the top-right corner of
 * a node card. Visible on hover or while the node is selected, and opens a
 * lightweight popover menu (Copy / Duplicate / Delete). Start nodes never render
 * this menu — they cannot be copied, duplicated, or deleted.
 */
export function WorkflowNodeActionsMenu({ node, selected, onNodeAction }: WorkflowNodeActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const visible = selected || open;

  return (
    <Popover
      id={`node-actions-${node.id}`}
      open={open}
      onOpenChange={setOpen}
      placement="bottom-end"
      offset={6}
      renderTrigger={({ ref, props }) => (
        <button
          {...props}
          ref={ref}
          type="button"
          aria-label="Node actions"
          title="Node actions"
          onClick={(event) => {
            event.stopPropagation();
            setOpen((current) => !current);
          }}
          className={[
            "nodrag nopan absolute -top-9 right-0 z-10 flex size-7 items-center justify-center rounded-md",
            "border border-border bg-card text-muted-foreground shadow-sm transition",
            "hover:bg-accent hover:text-foreground",
            visible ? "opacity-100" : "opacity-0 group-hover/card:opacity-100",
          ].join(" ")}
        >
          <MoreHorizontal size={16} aria-hidden />
        </button>
      )}
    >
      <div className="w-44 overflow-hidden rounded-md border border-border bg-card py-1 text-card-foreground shadow-xl shadow-black/20">
        <MenuItem
          icon={Copy}
          label="Copy"
          shortcut={`${MOD}C`}
          onSelect={() => onNodeAction(node.id, "copy")}
          onClose={() => setOpen(false)}
        />
        <MenuItem
          icon={CopyPlus}
          label="Duplicate"
          shortcut={`${MOD}D`}
          onSelect={() => onNodeAction(node.id, "duplicate")}
          onClose={() => setOpen(false)}
        />
        <div className="my-1 border-t border-border" />
        <MenuItem
          icon={Trash2}
          label="Delete"
          shortcut={isMac ? "⌫" : "Del"}
          destructive
          onSelect={() => onNodeAction(node.id, "delete")}
          onClose={() => setOpen(false)}
        />
      </div>
    </Popover>
  );
}

type MenuItemProps = {
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  destructive?: boolean;
  onSelect: () => void;
  onClose: () => void;
};

function MenuItem({ icon: Icon, label, shortcut, destructive, onSelect, onClose }: MenuItemProps) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
        onClose();
      }}
      className={[
        "flex w-full items-center gap-2.5 px-3 py-1.5 text-sm transition",
        destructive ? "text-destructive hover:bg-destructive/10" : "text-foreground hover:bg-accent",
      ].join(" ")}
    >
      <Icon size={15} className="shrink-0" aria-hidden />
      <span className="flex-1 text-left">{label}</span>
      {shortcut && <span className="text-xs text-muted-foreground">{shortcut}</span>}
    </button>
  );
}
