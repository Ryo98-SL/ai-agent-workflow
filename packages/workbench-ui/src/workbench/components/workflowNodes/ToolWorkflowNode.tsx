import { resolveToolDescriptor, type ToolDescriptor, type ToolNode } from "@ai-agent-workflow/workflow-domain";
import { useTranslation } from "@ai-agent-workflow/i18n";
import { VariableText } from "../VariableTag";
import { localizedToolDescriptor } from "../tools/localizedToolDescriptor";
import { WorkflowNodeCardShell, type WorkflowNodeProps } from "./WorkflowNodeCardShell";
import { resolveToolIcon } from "./workflowNodeVisuals";

export function ToolWorkflowNode(props: WorkflowNodeProps) {
  const { t } = useTranslation("workbench");
  const node = props.data.node;
  const descriptor = node.type === "tool" ? resolveToolDescriptor(node.config) : undefined;
  const localizedDescriptor = descriptor ? localizedToolDescriptor(descriptor, t) : undefined;
  const Icon = resolveToolIcon(localizedDescriptor?.icon);
  return (
    <WorkflowNodeCardShell {...props} Icon={Icon}>
      {node.type === "tool" && localizedDescriptor ? <ToolCardSummary node={node} descriptor={localizedDescriptor} /> : undefined}
    </WorkflowNodeCardShell>
  );
}

/**
 * Generic, descriptor-driven card body: `primary` string params render as a line
 * (variables shown as chips), and boolean params render as a status chip. No
 * per-tool hard-coding, so MCP/custom tools get a summary for free.
 */
function ToolCardSummary({ node, descriptor }: { node: ToolNode; descriptor: ToolDescriptor }) {
  const { t } = useTranslation("workbench");
  const primaries = descriptor.params.filter((param) => param.primary);
  const booleans = descriptor.params.filter((param) => param.type === "boolean");

  return (
    <div className="mt-1 space-y-0.5">
      {primaries.map((param) => {
        const value = node.config.params[param.name];
        return (
          <p key={param.name} className="truncate text-xs text-muted-foreground">
            {typeof value === "string" && value ? <VariableText text={value} /> : `（${param.label}）`}
          </p>
        );
      })}
      {booleans.map((param) => {
        const on = node.config.params[param.name] === true;
        return (
          <span
            key={param.name}
            className={[
              "inline-block rounded px-1 text-[10px]",
              on ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground",
            ].join(" ")}
          >
            {on ? param.label : `${param.label}: ${t("tools.off")}`}
          </span>
        );
      })}
    </div>
  );
}
