import { Pencil } from "lucide-react";
import { useState } from "react";
import type { WorkflowFile } from "@ai-agent-workflow/workflow-domain";
import { Input } from "@workbench/components/ui/input";
import { Textarea } from "@workbench/components/ui/textarea";
import { Label } from "@workbench/components/ui/label";
import { Button } from "./Button";
import { Popover } from "./Popover";
import { WORKFLOW_ICON_KEYS, WorkflowIconGlyph } from "./workflowIcons";

export type WorkflowMetaPatch = { name?: string; description?: string; icon?: string };

type WorkflowMetaEditorProps = {
  workflow: WorkflowFile;
  onUpdateMeta: (patch: WorkflowMetaPatch) => void;
};

export function WorkflowMetaEditor({ workflow, onUpdateMeta }: WorkflowMetaEditorProps) {
  const [open, setOpen] = useState(false);
  const { metadata } = workflow;

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      placement="bottom-start"
      renderTrigger={({ ref, props }) => (
        <Button
          {...props}
          ref={ref}
          variant="ghost"
          size="iconMd"
          className="size-7"
          aria-label="Edit workflow details"
          title="Edit workflow details"
          onClick={() => setOpen((v) => !v)}
        >
          <Pencil size={14} aria-hidden />
        </Button>
      )}
    >
      <div className="w-[320px] space-y-3 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-xl">
        <div className="space-y-1.5">
          <Label>Icon</Label>
          <div className="grid grid-cols-6 gap-1">
            {WORKFLOW_ICON_KEYS.map((key) => {
              const selected = (metadata.icon ?? "workflow") === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onUpdateMeta({ icon: key })}
                  className={`flex aspect-square items-center justify-center rounded-md border ${
                    selected
                      ? "border-brand bg-brand/15 text-brand"
                      : "border-border text-muted-foreground hover:bg-accent"
                  }`}
                >
                  <WorkflowIconGlyph icon={key} size={16} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="workflow-meta-name">Name</Label>
          <Input
            id="workflow-meta-name"
            value={metadata.name}
            onChange={(e) => onUpdateMeta({ name: e.target.value })}
            placeholder="Workflow name"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="workflow-meta-desc">Description</Label>
          <Textarea
            id="workflow-meta-desc"
            rows={3}
            value={metadata.description ?? ""}
            onChange={(e) => onUpdateMeta({ description: e.target.value })}
            placeholder="What does this workflow do?"
          />
        </div>
      </div>
    </Popover>
  );
}
