import { Brain } from "lucide-react";
import { ModelCapabilityTags } from "../ModelCapabilityTags";
import { getModelCapabilities } from "../modelCatalog";
import { ModelProviderLogo } from "../modelProviderVisuals";
import { VariableText } from "../VariableTag";
import { WorkflowNodeCardShell, type WorkflowNodeProps } from "./WorkflowNodeCardShell";

export function LlmWorkflowNode(props: WorkflowNodeProps) {
  const { activeModel, activeModelProvider, node } = props.data;
  const model = activeModel;
  const modelLabel = model || "Use global model";
  const capabilities = getModelCapabilities(model, activeModelProvider);

  return (
    <WorkflowNodeCardShell {...props} Icon={Brain}>
      <div className="mt-3 space-y-2">
        <div
          className="flex h-9 items-center gap-2 rounded-md border border-border bg-muted px-2"
          title={`Model: ${modelLabel}`}
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-border bg-background">
            <ModelProviderLogo provider={activeModelProvider} />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{modelLabel}</span>
          <ModelCapabilityTags capabilities={capabilities} />
        </div>
        {node.description && (
          <p className="text-xs leading-5 text-muted-foreground">
            <VariableText text={node.description} />
          </p>
        )}
      </div>
    </WorkflowNodeCardShell>
  );
}
