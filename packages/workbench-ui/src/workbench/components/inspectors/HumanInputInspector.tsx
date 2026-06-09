import type { ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { HumanInputAction, HumanInputNode, WorkflowNode } from "@ai-agent-workflow/workflow-domain";
import { Input } from "@workbench/components/ui/input";
import { Textarea } from "@workbench/components/ui/textarea";
import { NodeOutputVariablesPanel } from "../NodeOutputVariablesPanel";

type HumanInputInspectorProps = {
  node: HumanInputNode;
  updateNode: (nodeId: string, updater: (node: WorkflowNode) => WorkflowNode) => void;
};

function nextActionId(actions: HumanInputAction[]): string {
  const used = new Set(actions.map((action) => action.id));
  let index = actions.length + 1;
  while (used.has(`action-${index}`) || `action-${index}` === "__input__") {
    index += 1;
  }
  return `action-${index}`;
}

export function HumanInputInspector({ node, updateNode }: HumanInputInspectorProps) {
  const updateConfig = (patch: Partial<HumanInputNode["config"]>) => {
    updateNode(node.id, (current) =>
      current.type === "humanInput" ? { ...current, config: { ...current.config, ...patch } } : current,
    );
  };

  const patchAction = (index: number, patch: Partial<HumanInputAction>) => {
    updateConfig({ actions: node.config.actions.map((action, i) => (i === index ? { ...action, ...patch } : action)) });
  };

  return (
    <div className="space-y-4">
      <Field label="Prompt">
        <Textarea
          value={node.config.prompt}
          onChange={(event) => updateConfig({ prompt: event.target.value })}
          placeholder="请审核以下内容…  支持 {{nodeId.field}} 变量"
          rows={3}
        />
      </Field>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Action buttons</h3>
        </div>
        <div className="space-y-2">
          {node.config.actions.map((action, index) => (
            <div key={action.id} className="space-y-2 rounded-md border border-border bg-card p-2">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Field label="Label">
                    <Input value={action.label} onChange={(event) => patchAction(index, { label: event.target.value })} placeholder="通过" />
                  </Field>
                </div>
                <div className="flex-1">
                  <Field label="Value">
                    <Input value={action.value} onChange={(event) => patchAction(index, { value: event.target.value })} placeholder="approved" />
                  </Field>
                </div>
                <button
                  type="button"
                  aria-label={`Remove action ${action.label || action.id}`}
                  className="mt-5 h-8 shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => updateConfig({ actions: node.config.actions.filter((_, i) => i !== index) })}
                >
                  <Trash2 size={14} aria-hidden />
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                outputs <code className="text-foreground">action_id={action.id}</code>
              </p>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="flex items-center gap-1 text-xs font-medium text-brand transition-colors hover:text-brand/80"
          onClick={() =>
            updateConfig({
              actions: [...node.config.actions, { id: nextActionId(node.config.actions), label: "新操作", value: "" }],
            })
          }
        >
          <Plus size={12} aria-hidden /> Add action
        </button>
      </section>

      <section className="space-y-2 rounded-md border border-border bg-card p-3">
        <label className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-foreground">Allow free-text reply</span>
          <input
            type="checkbox"
            checked={node.config.allowTextInput}
            onChange={(event) => updateConfig({ allowTextInput: event.target.checked })}
            className="size-4 accent-[hsl(var(--brand))]"
          />
        </label>
        <p className="text-xs text-muted-foreground">
          When on, the reviewer can submit edited text — it arrives as
          <code className="mx-1 text-foreground">action_id="__input__"</code>with the text in
          <code className="ml-1 text-foreground">action_value</code>.
        </p>
        {node.config.allowTextInput && (
          <div className="space-y-2 pt-1">
            <Field label="Input label">
              <Input
                value={node.config.inputLabel ?? ""}
                onChange={(event) => updateConfig({ inputLabel: event.target.value || undefined })}
                placeholder="回复内容"
              />
            </Field>
            <Field label="Default text">
              <Textarea
                value={node.config.defaultText ?? ""}
                onChange={(event) => updateConfig({ defaultText: event.target.value || undefined })}
                placeholder="预填文本，支持 {{nodeId.field}} 变量"
                rows={2}
              />
            </Field>
          </div>
        )}
      </section>

      <NodeOutputVariablesPanel nodeType="humanInput" />
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
