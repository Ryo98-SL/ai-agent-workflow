import { Check, ChevronsUpDown, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import type { WorkflowFile } from "@ai-agent-workflow/workflow-domain";
import { useWorkflows } from "../../data/useWorkflows";
import { FIELD_SHELL_CLASS, FIELD_SHELL_INPUT_CLASS } from "./fieldStyles";
import { Button } from "./Button";
import { Popover } from "./Popover";
import { WorkflowIconGlyph } from "./workflowIcons";

type WorkflowSwitcherProps = {
  workflow: WorkflowFile;
  workflowId?: string;
  dirty: boolean;
  onSwitch: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
};

export function WorkflowSwitcher({ workflow, workflowId, dirty, onSwitch, onCreate, onDelete }: WorkflowSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const { data, isLoading } = useWorkflows();

  const normalized = query.trim().toLowerCase();
  const workflows = (data?.workflows ?? []).filter(
    (item) => normalized === "" || item.name.toLowerCase().includes(normalized),
  );

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQuery("");
          setConfirmingId(null);
        }
      }}
      placement="bottom-start"
      renderTrigger={({ ref, props }) => (
        <Button
          {...props}
          ref={ref}
          variant="ghost"
          size="unstyled"
          className="-ml-1 flex min-w-0 max-w-[260px] items-center gap-2 rounded-md px-2 py-1 hover:bg-accent"
          onClick={() => setOpen((v) => !v)}
          aria-label="Switch workflow"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand text-brand-foreground">
            <WorkflowIconGlyph icon={workflow.metadata.icon} size={15} />
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="flex items-center gap-1">
              <span className="truncate text-sm font-semibold">{workflow.metadata.name}</span>
              {dirty && <span className="size-1.5 shrink-0 rounded-full bg-brand" title="Unsaved changes" />}
            </span>
          </span>
          <ChevronsUpDown size={14} className="shrink-0 text-muted-foreground" aria-hidden />
        </Button>
      )}
    >
      <div className="w-[320px] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-xl">
        <div className="border-b border-border p-2">
          <label className={FIELD_SHELL_CLASS}>
            <Search size={14} className="text-muted-foreground" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search workflows"
              className={FIELD_SHELL_INPUT_CLASS}
            />
          </label>
        </div>

        <div className="max-h-64 overflow-y-auto py-1">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-muted-foreground">
              <Loader2 size={15} className="animate-spin" aria-hidden /> Loading…
            </div>
          ) : workflows.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No workflows found.</p>
          ) : (
            workflows.map((item) => {
              const active = item.id === workflowId;

              if (confirmingId === item.id) {
                return (
                  <div key={item.id} className="flex h-11 items-center gap-2 px-3">
                    <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                      Delete “{item.name}”?
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => {
                        onDelete(item.id);
                        setConfirmingId(null);
                      }}
                    >
                      Delete
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmingId(null)}>
                      Cancel
                    </Button>
                  </div>
                );
              }

              return (
                <div key={item.id} className="group/wf flex h-11 items-center gap-1 px-1">
                  <Button
                    variant="ghost"
                    size="unstyled"
                    className="h-full min-w-0 flex-1 justify-start gap-2 rounded-md px-2 text-sm hover:bg-accent"
                    onClick={() => {
                      onSwitch(item.id);
                      setOpen(false);
                    }}
                  >
                    <WorkflowIconGlyph size={15} />
                    <span className="min-w-0 flex-1 truncate text-left">{item.name}</span>
                    {active && <Check size={15} className="shrink-0 text-brand" aria-hidden />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="iconMd"
                    aria-label={`Delete ${item.name}`}
                    className="opacity-0 group-hover/wf:opacity-100"
                    onClick={() => setConfirmingId(item.id)}
                  >
                    <Trash2 size={14} aria-hidden />
                  </Button>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-border p-1">
          <Button
            variant="ghost"
            size="unstyled"
            fullWidth
            className="justify-start gap-2 rounded-md px-2 py-2 text-sm text-brand hover:bg-accent"
            onClick={() => {
              onCreate();
              setOpen(false);
            }}
          >
            <Plus size={15} aria-hidden /> New workflow
          </Button>
        </div>
      </div>
    </Popover>
  );
}
