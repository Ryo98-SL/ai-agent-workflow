import { Settings2 } from "lucide-react";
import {
  parsePromptVariableReferences,
  workflowNodeOutputFields,
  type KnowledgeNode,
  type WorkflowFile,
  type WorkflowNode,
} from "@ai-agent-workflow/workflow-domain";
import { Input } from "@workbench/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workbench/components/ui/select";
import { Textarea } from "@workbench/components/ui/textarea";
import { useKnowledgeBases } from "../../../data/useKnowledgeBases";
import { Button } from "../Button";
import { NodeOutputVariablesPanel } from "../NodeOutputVariablesPanel";

type KnowledgeInspectorProps = {
  workflow: WorkflowFile;
  node: KnowledgeNode;
  onOpenKnowledgeBases?: () => void;
  updateNode: (nodeId: string, updater: (node: WorkflowNode) => WorkflowNode) => void;
};

export function KnowledgeInspector({ workflow, node, onOpenKnowledgeBases, updateNode }: KnowledgeInspectorProps) {
  const knowledgeBases = useKnowledgeBases();
  const selectedId = node.config.knowledgeBaseIds[0] ?? "";
  const variables = parsePromptVariableReferences(node.config.queryTemplate);

  const updateConfig = (patch: Partial<KnowledgeNode["config"]>) => {
    updateNode(node.id, (current) =>
      current.type === "knowledge" ? { ...current, config: { ...current.config, ...patch } } : current,
    );
  };

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Knowledge Base</h3>
          <Button variant="ghost" size="sm" onClick={onOpenKnowledgeBases}>
            <Settings2 size={14} aria-hidden />
            Manage
          </Button>
        </div>
        <Select value={selectedId || "none"} onValueChange={(value) => updateConfig({ knowledgeBaseIds: value === "none" ? [] : [value] })}>
          <SelectTrigger aria-label="Knowledge base">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {(knowledgeBases.data?.knowledgeBases ?? []).map((knowledgeBase) => (
              <SelectItem key={knowledgeBase.id} value={knowledgeBase.id}>
                {knowledgeBase.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {knowledgeBases.isLoading && <p className="text-xs text-muted-foreground">Loading...</p>}
        {knowledgeBases.error && <p className="text-xs text-destructive">Knowledge bases failed to load.</p>}
      </section>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">Query Template</span>
        <Textarea
          value={node.config.queryTemplate}
          onChange={(event) => updateConfig({ queryTemplate: event.target.value })}
          className="min-h-20 resize-y leading-5"
        />
      </label>

      <section className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Top K</span>
          <Input
            type="number"
            min={1}
            max={20}
            value={node.config.retrieval.topK}
            onChange={(event) =>
              updateConfig({
                retrieval: { ...node.config.retrieval, topK: clampInt(event.target.value, 1, 20) },
              })
            }
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Min Score</span>
          <Input
            type="number"
            min={0}
            max={1}
            step={0.01}
            value={node.config.retrieval.scoreThreshold ?? ""}
            placeholder="auto"
            onChange={(event) =>
              updateConfig({
                retrieval: {
                  ...node.config.retrieval,
                  scoreThreshold: event.target.value === "" ? undefined : clampNumber(event.target.value, 0, 1),
                },
              })
            }
          />
        </label>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prompt Variables</h3>
        {variables.length === 0 ? (
          <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">{"{{start1.topic}}"}</p>
        ) : (
          <div className="space-y-2">
            {variables.map((variable) => (
              <div key={variable.value} className="rounded-md border border-border bg-card p-3">
                <div className="flex items-center justify-between gap-3">
                  <code className="min-w-0 break-all text-xs font-semibold text-foreground">{variable.value}</code>
                  <span
                    className={[
                      "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                      promptReferenceStatus(workflow, variable) === "resolvable"
                        ? "bg-brand/15 text-brand"
                        : "bg-amber-500/15 text-amber-700 dark:text-amber-400",
                    ].join(" ")}
                  >
                    {promptReferenceStatus(workflow, variable)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <NodeOutputVariablesPanel nodeType="knowledge" />
    </div>
  );
}

function promptReferenceStatus(
  workflow: WorkflowFile,
  variable: ReturnType<typeof parsePromptVariableReferences>[number],
): string {
  if (!variable.ok) return variable.error;
  const producer = workflow.graph.nodes.find((node) => node.id === variable.nodeId);
  if (!producer) return "missing producer";
  const firstField = variable.path[0];
  if (producer.type === "start" && producer.config.fields.some((field) => field.name === firstField)) return "resolvable";
  if (workflowNodeOutputFields(producer.type).some((field) => field.name === firstField)) return "resolvable";
  return "missing field";
}

function clampInt(value: string, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.parseInt(value, 10) || min));
}

function clampNumber(value: string, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.parseFloat(value) || min));
}
