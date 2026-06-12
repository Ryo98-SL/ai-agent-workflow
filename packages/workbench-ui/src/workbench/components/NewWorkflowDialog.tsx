import { useEffect, useRef, useState } from "react";
import { WORKFLOW_TEMPLATES, type WorkflowTemplate } from "@ai-agent-workflow/workflow-domain";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@workbench/components/ui/dialog";
import { Badge } from "@workbench/components/ui/badge";
import { Button } from "./Button";
import { WorkflowIconGlyph } from "./workflowIcons";

type NewWorkflowDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (template: WorkflowTemplate) => void;
};

/** The flagship example is the most useful default to preview. */
const DEFAULT_TEMPLATE_ID = WORKFLOW_TEMPLATES[WORKFLOW_TEMPLATES.length - 1]?.id;

export function NewWorkflowDialog({ open, onOpenChange, onSelect }: NewWorkflowDialogProps) {
  const [selectedId, setSelectedId] = useState(DEFAULT_TEMPLATE_ID);
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Reset the preview to the default each time the dialog opens.
  useEffect(() => {
    if (open) {
      setSelectedId(DEFAULT_TEMPLATE_ID);
    }
  }, [open]);

  const selected = WORKFLOW_TEMPLATES.find((template) => template.id === selectedId) ?? WORKFLOW_TEMPLATES[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[720px] max-w-[92vw]"
        onOpenAutoFocus={(event) => {
          // Focus the confirm button so no list item shows a focus ring that
          // competes with the highlighted (selected) preview item.
          event.preventDefault();
          confirmRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>新建工作流</DialogTitle>
          <DialogDescription>选择一个示例开始，或从空白搭建。</DialogDescription>
        </DialogHeader>

        <div className="flex h-[320px] gap-4">
          <div className="w-56 shrink-0 space-y-1 overflow-y-auto border-r border-border pr-3">
            {WORKFLOW_TEMPLATES.map((template) => {
              const active = template.id === selected.id;
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setSelectedId(template.id)}
                  className={[
                    "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors",
                    active ? "bg-accent" : "hover:bg-accent/60",
                  ].join(" ")}
                >
                  <IconTile icon={template.icon} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{template.name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{template.description}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-2">
              <IconTile icon={selected.icon} />
              <h3 className="min-w-0 flex-1 truncate text-base font-semibold">{selected.name}</h3>
              <RequiresBadge requires={selected.requires} />
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{selected.description}</p>

            <div className="mt-4 space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">流程</span>
              <FlowPills flow={selected.flow} />
            </div>

            {selected.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {selected.tags.map((tag) => (
                  <span key={tag} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-auto flex items-center justify-end gap-2 pt-4">
              <Button variant="secondary" size="md" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button ref={confirmRef} variant="success" size="md" onClick={() => onSelect(selected)}>
                {selected.id === "blank" ? "从空白开始" : "使用此示例"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function IconTile({ icon }: { icon: string }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand text-brand-foreground">
      <WorkflowIconGlyph icon={icon} size={18} />
    </span>
  );
}

function RequiresBadge({ requires }: { requires: WorkflowTemplate["requires"] }) {
  if (requires.includes("credits")) {
    return (
      <Badge variant="secondary" className="shrink-0">
        需登录 · credits
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="shrink-0 border-brand/40 text-brand">
      可直接运行
    </Badge>
  );
}

function FlowPills({ flow }: { flow: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
      {flow.map((step, index) => (
        <span key={step} className="flex items-center gap-1">
          <span className="rounded border border-border bg-card px-1.5 py-0.5">{step}</span>
          {index < flow.length - 1 && <span className="text-muted-foreground/60">→</span>}
        </span>
      ))}
    </div>
  );
}
