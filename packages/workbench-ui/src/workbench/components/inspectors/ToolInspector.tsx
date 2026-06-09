import type { ReactNode } from "react";
import type { ToolAdapter, ToolNode, WorkflowNode } from "@ai-agent-workflow/workflow-domain";
import { Input } from "@workbench/components/ui/input";
import { Textarea } from "@workbench/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workbench/components/ui/select";
import { NodeOutputVariablesPanel } from "../NodeOutputVariablesPanel";

type ToolInspectorProps = {
  node: ToolNode;
  updateNode: (nodeId: string, updater: (node: WorkflowNode) => WorkflowNode) => void;
};

function defaultConfigFor(adapter: ToolAdapter): ToolNode["config"] {
  return adapter === "emailSend"
    ? { adapter: "emailSend", to: "", subject: "", body: "", send: false }
    : { adapter: "currentTime", timezone: "UTC" };
}

export function ToolInspector({ node, updateNode }: ToolInspectorProps) {
  const setConfig = (config: ToolNode["config"]) => {
    updateNode(node.id, (current) => (current.type === "tool" ? { ...current, config } : current));
  };

  const config = node.config;

  return (
    <div className="space-y-4">
      <Field label="Adapter">
        <Select
          value={config.adapter}
          onValueChange={(value) => {
            const adapter = value as ToolAdapter;
            if (adapter === config.adapter) {
              return;
            }
            // Switch config shape, and refresh the label when it's still the
            // other adapter's default (so an email node isn't titled "Current Time").
            const defaultLabels: Record<ToolAdapter, string> = { currentTime: "Current Time", emailSend: "Send Email" };
            updateNode(node.id, (current) =>
              current.type === "tool"
                ? {
                    ...current,
                    label: current.label === defaultLabels[current.config.adapter] ? defaultLabels[adapter] : current.label,
                    config: defaultConfigFor(adapter),
                  }
                : current,
            );
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="currentTime">Current Time</SelectItem>
            <SelectItem value="emailSend">Send Email</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {config.adapter === "currentTime" ? (
        <Field label="Timezone">
          <Input value={config.timezone} onChange={(event) => setConfig({ ...config, timezone: event.target.value })} placeholder="UTC" />
        </Field>
      ) : (
        <>
          <Field label="To">
            <Input value={config.to} onChange={(event) => setConfig({ ...config, to: event.target.value })} placeholder="user@example.com  ·  支持 {{nodeId.field}}" />
          </Field>
          <Field label="Subject">
            <Input value={config.subject} onChange={(event) => setConfig({ ...config, subject: event.target.value })} placeholder="工单已受理  ·  支持 {{nodeId.field}}" />
          </Field>
          <Field label="Body">
            <Textarea value={config.body} onChange={(event) => setConfig({ ...config, body: event.target.value })} rows={5} placeholder="邮件正文，支持 {{nodeId.field}} 变量" />
          </Field>

          <label className="flex items-start justify-between gap-3 rounded-md border border-border bg-card p-3">
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">Send for real</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Off = dry-run (compose only, no email sent, no cost). On requires a server-configured provider.
              </span>
            </span>
            <input
              type="checkbox"
              checked={config.send}
              onChange={(event) => setConfig({ ...config, send: event.target.checked })}
              className="mt-0.5 size-4 shrink-0 accent-[hsl(var(--brand))]"
            />
          </label>
          {!config.send && (
            <p className="rounded-md bg-brand/10 p-3 text-xs leading-5 text-brand">
              Dry-run: this node outputs the composed email (to / subject / body) without sending anything.
            </p>
          )}
        </>
      )}

      <NodeOutputVariablesPanel nodeType="tool" />
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
