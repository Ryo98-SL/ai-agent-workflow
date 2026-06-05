import type { ReactNode } from "react";
import type { ToolNode, WorkflowNode } from "@ai-agent-workflow/workflow-domain";
import { Input } from "@workbench/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workbench/components/ui/select";

type ToolInspectorProps = {
  node: ToolNode;
  updateNode: (nodeId: string, updater: (node: WorkflowNode) => WorkflowNode) => void;
};

export function ToolInspector({ node, updateNode }: ToolInspectorProps) {
  const updateConfig = (patch: Partial<ToolNode["config"]>) => {
    updateNode(node.id, (current) =>
      current.type === "tool" ? { ...current, config: { ...current.config, ...patch } } : current,
    );
  };

  return (
    <div className="space-y-4">
      <Field label="Adapter">
        <Select value={node.config.adapter} onValueChange={(value) => updateConfig({ adapter: value as ToolNode["config"]["adapter"] })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="currentTime">Current Time</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Timezone">
        <Input
          value={node.config.timezone}
          onChange={(event) => updateConfig({ timezone: event.target.value })}
          placeholder="UTC"
        />
      </Field>
      <p className="rounded-md bg-brand/10 p-3 text-sm leading-5 text-brand">
        This built-in tool returns the current time through the same runtime boundary as the LLM adapter.
      </p>
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
