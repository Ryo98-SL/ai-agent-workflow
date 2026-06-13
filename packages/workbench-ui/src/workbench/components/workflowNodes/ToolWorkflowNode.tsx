import { resolveToolDescriptor, type ToolDescriptor, type ToolNode } from "@ai-agent-workflow/workflow-domain";
import { VariableText } from "../VariableTag";
import { WorkflowNodeCardShell, type WorkflowNodeProps } from "./WorkflowNodeCardShell";
import { resolveToolIcon } from "./workflowNodeVisuals";

export function ToolWorkflowNode(props: WorkflowNodeProps) {
  const node = props.data.node;
  const descriptor = node.type === "tool" ? resolveToolDescriptor(node.config) : undefined;
  const Icon = resolveToolIcon(descriptor?.icon);
  return (
    <WorkflowNodeCardShell {...props} Icon={Icon}>
      {node.type === "tool" && descriptor ? <ToolCardSummary node={node} descriptor={descriptor} /> : undefined}
    </WorkflowNodeCardShell>
  );
}

/**
 * Generic, descriptor-driven card body: `primary` string params render as a line
 * (variables shown as chips), and boolean params render as a status chip. No
 * per-tool hard-coding, so MCP/custom tools get a summary for free.
 */
function ToolCardSummary({ node, descriptor }: { node: ToolNode; descriptor: ToolDescriptor }) {
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
            {on ? param.label : `${param.label}: off`}
          </span>
        );
      })}
    </div>
  );
}
