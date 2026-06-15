import { Bot } from "lucide-react";
import { resolveToolDescriptor, type AgentNode } from "@ai-agent-workflow/workflow-domain";
import { ModelProviderLogo } from "../modelProviderVisuals";
import { WorkflowNodeCardShell, type WorkflowNodeProps } from "./WorkflowNodeCardShell";
import { resolveToolIcon } from "./workflowNodeVisuals";

/**
 * Agent node card (ADR 0005): model row + a compact tool-list summary (count + the
 * first few tool icons) + a strategy badge. Mirrors the LLM card's chrome.
 */
export function AgentWorkflowNode(props: WorkflowNodeProps) {
  const { activeModelProvider, activeModel, node } = props.data;
  const config = node.type === "agent" ? (node as AgentNode).config : undefined;
  const modelLabel = activeModel || "Use global model";
  const tools = config?.tools ?? [];
  const iconTools = tools.slice(0, 4);

  return (
    <WorkflowNodeCardShell {...props} Icon={Bot}>
      <div className="mt-3 space-y-2">
        <div
          className="flex h-9 items-center gap-2 rounded-md border border-border bg-muted px-2"
          title={`Model: ${modelLabel}`}
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-border bg-background">
            <ModelProviderLogo provider={activeModelProvider} />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{modelLabel}</span>
          {config && (
            <span className="shrink-0 rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300">
              {config.strategy === "react" ? "ReAct" : "FC"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="shrink-0">{tools.length} 个工具</span>
          {iconTools.length > 0 && (
            <span className="flex items-center gap-1">
              {iconTools.map((tool, index) => {
                const Icon = resolveToolIcon(resolveToolDescriptor(tool)?.icon);
                return (
                  <span
                    key={`${tool.provider}:${tool.providerId}:${tool.toolName}:${index}`}
                    className="flex size-5 items-center justify-center rounded bg-amber-700 text-white"
                  >
                    <Icon size={11} aria-hidden />
                  </span>
                );
              })}
              {tools.length > iconTools.length && <span>+{tools.length - iconTools.length}</span>}
            </span>
          )}
        </div>
      </div>
    </WorkflowNodeCardShell>
  );
}
