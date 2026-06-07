import { Pencil, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@workbench/components/ui/input";
import { Textarea } from "@workbench/components/ui/textarea";
import { Label } from "@workbench/components/ui/label";
import { Button } from "./Button";
import { Popover } from "./Popover";
import { WORKFLOW_ICON_KEYS, WorkflowIconGlyph } from "./workflowIcons";

export type WorkflowMetaPatch = { name?: string; description?: string; icon?: string };
export type WorkflowMetaEditorValue = { name: string; description?: string; icon?: string };

type WorkflowMetaEditorProps = {
  metadata: WorkflowMetaEditorValue;
  onSaveMeta: (patch: WorkflowMetaPatch) => Promise<boolean>;
};

function workflowMetaDraft(metadata: WorkflowMetaEditorValue): Required<WorkflowMetaPatch> {
  return {
    name: metadata.name,
    description: metadata.description ?? "",
    icon: metadata.icon ?? "workflow",
  };
}

export function WorkflowMetaEditor({ metadata, onSaveMeta }: WorkflowMetaEditorProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Required<WorkflowMetaPatch>>(() => workflowMetaDraft(metadata));

  useEffect(() => {
    if (!open) {
      setDraft(workflowMetaDraft(metadata));
    }
  }, [metadata.description, metadata.icon, metadata.name, open]);

  const dirty = useMemo(
    () =>
      draft.name !== metadata.name ||
      draft.description !== (metadata.description ?? "") ||
      draft.icon !== (metadata.icon ?? "workflow"),
    [draft.description, draft.icon, draft.name, metadata.description, metadata.icon, metadata.name],
  );

  const saveMeta = async () => {
    if (!dirty || saving) {
      return;
    }

    setSaving(true);
    try {
      const saved = await onSaveMeta({
        name: draft.name,
        description: draft.description,
        icon: draft.icon,
      });
      if (saved) {
        setOpen(false);
      }
    } finally {
      setSaving(false);
    }
  };
  const setEditorOpen = (nextOpen: boolean) => {
    if (nextOpen) {
      setDraft(workflowMetaDraft(metadata));
    }
    setOpen(nextOpen);
  };

  return (
    <Popover
      open={open}
      preserveNestedPopoverPress={false}
      onOpenChange={setEditorOpen}
      placement="bottom-start"
      renderTrigger={({ ref, props }) => (
        <Button
          {...props}
          ref={ref}
          variant="ghost"
          size="iconMd"
          className="size-7"
          aria-label={`Edit ${metadata.name} workflow details`}
          title="Edit workflow details"
          onClick={(event) => {
            event.stopPropagation();
            setEditorOpen(!open);
          }}
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
              const selected = draft.icon === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDraft((current) => ({ ...current, icon: key }))}
                  aria-label={`Use ${key} workflow icon`}
                  title={key}
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
            value={draft.name}
            onChange={(e) => setDraft((current) => ({ ...current, name: e.target.value }))}
            placeholder="Workflow name"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="workflow-meta-desc">Description</Label>
          <Textarea
            id="workflow-meta-desc"
            rows={3}
            value={draft.description}
            onChange={(e) => setDraft((current) => ({ ...current, description: e.target.value }))}
            placeholder="What does this workflow do?"
          />
        </div>

        <div className="flex justify-end border-t border-border pt-3">
          <Button
            variant="primary"
            size="sm"
            onClick={saveMeta}
            disabled={!dirty || saving}
            aria-label="Save workflow details"
          >
            <Save size={14} aria-hidden />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </Popover>
  );
}
