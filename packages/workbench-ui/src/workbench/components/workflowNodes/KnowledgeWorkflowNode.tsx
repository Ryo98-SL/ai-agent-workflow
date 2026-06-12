import { Database } from "lucide-react";
import { useKnowledgeBases } from "../../../data/useKnowledgeBases";
import { VariableText } from "../VariableTag";
import { WorkflowNodeCardShell, type WorkflowNodeProps } from "./WorkflowNodeCardShell";

export function KnowledgeWorkflowNode(props: WorkflowNodeProps) {
  const node = props.data.node;
  const knowledgeBases = useKnowledgeBases();
  if (node.type !== "knowledge") {
    return <WorkflowNodeCardShell {...props} Icon={Database} />;
  }
  const selectedId = node.config.knowledgeBaseIds[0];
  const selected = knowledgeBases.data?.knowledgeBases.find((base) => base.id === selectedId);
  const query = node.config.queryTemplate.replace(/\s+/g, " ").trim();

  return (
    <WorkflowNodeCardShell {...props} Icon={Database}>
      <div className="mt-2 space-y-1">
        <p className="truncate text-xs font-medium text-foreground">{selected?.name ?? (selectedId ? selectedId : "No knowledge base")}</p>
        <p className="text-xs leading-5 text-muted-foreground">
          <VariableText text={query || "{{start1.topic}}"} />
        </p>
        <p className="text-[10px] font-semibold uppercase text-muted-foreground">Top {node.config.retrieval.topK}</p>
      </div>
    </WorkflowNodeCardShell>
  );
}
