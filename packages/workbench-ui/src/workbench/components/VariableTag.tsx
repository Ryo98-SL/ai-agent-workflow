import { Fragment, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { parseVariableReference } from "@ai-agent-workflow/workflow-domain";
import { useResolveNode } from "./WorkflowGraphContext";
import { workflowNodeIcons } from "./workflowNodes/workflowNodeVisuals";

const VARIABLE_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}/g;

/**
 * A single workflow Variable Reference rendered as a Dify-style pill: the
 * producing node's identity (icon + label) and the variable name with a `{x}`
 * glyph. The node identity is resolved from the graph context; when the
 * reference can't be resolved (deleted/renamed node, malformed string) the tag
 * falls back to an amber error state but still shows the raw text.
 *
 * `reference` accepts either the wrapped `{{nodeId.path}}` form or the bare
 * `nodeId.path` form. Shared by node cards, inspectors, and inline rich text so
 * the variable styling stays consistent everywhere.
 */
export function VariableTag({ reference, className }: { reference: string; className?: string }) {
  const parsed = parseVariableReference(reference);
  const node = useResolveNode(parsed.ok ? parsed.nodeId : undefined);

  const base =
    "inline-flex max-w-full items-center gap-1 rounded border px-1 py-0.5 align-middle leading-none";

  // Malformed or unresolved (node not in graph): amber error pill.
  if (!parsed.ok || !node) {
    const label = parsed.ok ? parsed.path.join(".") : reference.replace(/^\{\{\s*|\s*\}\}$/g, "");
    return (
      <span
        className={[base, "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400", className ?? ""].join(" ")}
        title={parsed.ok ? `未找到上游节点 “${parsed.nodeId}”` : "无法识别的变量引用"}
      >
        <AlertTriangle className="size-2.5 shrink-0" aria-hidden />
        <span className="truncate text-[11px] font-medium">{label}</span>
      </span>
    );
  }

  const NodeIcon = workflowNodeIcons[node.type];
  return (
    <span
      className={[base, "border-border bg-muted", className ?? ""].join(" ")}
      title={`${node.label} / ${parsed.path.join(".")}`}
    >
      <span className="flex size-3.5 shrink-0 items-center justify-center rounded-sm bg-foreground/10 text-foreground/70">
        <NodeIcon className="size-2.5" aria-hidden />
      </span>
      <span className="max-w-[7rem] truncate text-[11px] font-medium text-muted-foreground">{node.label}</span>
      <span className="shrink-0 text-muted-foreground/50">/</span>
      <span className="shrink-0 font-mono text-[10px] font-semibold text-blue-500">{"{x}"}</span>
      <span className="truncate text-[11px] font-medium text-foreground">{parsed.path.join(".")}</span>
    </span>
  );
}

/**
 * Renders free text, turning every `{{nodeId.field}}` token into a `VariableTag`
 * pill so descriptions/templates show variables in the unified style instead of
 * raw `{{...}}` text.
 */
export function VariableText({ text, className }: { text: string; className?: string }) {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  for (const match of text.matchAll(VARIABLE_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      nodes.push(<Fragment key={`t${key}`}>{text.slice(lastIndex, index)}</Fragment>);
    }
    nodes.push(<VariableTag key={`v${key}`} reference={match[1].trim()} />);
    lastIndex = index + match[0].length;
    key += 1;
  }
  if (lastIndex < text.length) {
    nodes.push(<Fragment key={`t${key}`}>{text.slice(lastIndex)}</Fragment>);
  }
  return <span className={className}>{nodes}</span>;
}
