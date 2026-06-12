import { Fragment, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { parseVariableReference } from "@ai-agent-workflow/workflow-domain";
import { useResolveNode, useVariableAvailability } from "./WorkflowGraphContext";
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
 *
 * Inside a `VariableConsumerProvider` it also reflects availability: a chip whose
 * producing node is no longer a connected upstream of the consumer drops the node
 * identity and gains a trailing warning to flag that the variable can't resolve.
 * `selected` adds a ring so the editor can show the chip selected as one unit.
 */
export function VariableTag({
  reference,
  className,
  selected = false,
}: {
  reference: string;
  className?: string;
  selected?: boolean;
}) {
  const parsed = parseVariableReference(reference);
  const node = useResolveNode(parsed.ok ? parsed.nodeId : undefined);
  const availability = useVariableAvailability(parsed.ok ? parsed.nodeId : undefined);

  const base =
    "inline-flex max-w-full items-center gap-1 rounded border px-1 py-0.5 align-middle leading-none";
  const ring = selected ? "ring-2 ring-ring ring-offset-1 ring-offset-background" : "";

  // Malformed or unresolved (node not in graph): amber error pill.
  if (!parsed.ok || !node) {
    const label = parsed.ok ? parsed.path.join(".") : reference.replace(/^\{\{\s*|\s*\}\}$/g, "");
    return (
      <span
        className={[base, ring, "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400", className ?? ""].join(" ")}
        title={parsed.ok ? `未找到上游节点 “${parsed.nodeId}”` : "无法识别的变量引用"}
      >
        <AlertTriangle className="size-2.5 shrink-0" aria-hidden />
        <span className="truncate text-[11px] font-medium">{label}</span>
      </span>
    );
  }

  // Node exists but is no longer a connected upstream of the consumer: keep the
  // variable name but drop the node identity and append a warning (the chip can
  // no longer resolve at runtime).
  if (availability === "unavailable") {
    return (
      <span
        className={[base, ring, "border-amber-500/40 bg-amber-500/10", className ?? ""].join(" ")}
        title={`变量 “${node.label} / ${parsed.path.join(".")}” 当前不可用：与上游节点的连接已断开`}
      >
        <span className="shrink-0 font-mono text-[10px] font-semibold text-blue-500">{"{x}"}</span>
        <span className="truncate text-[11px] font-medium text-foreground">{parsed.path.join(".")}</span>
        <AlertTriangle className="size-2.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
      </span>
    );
  }

  const NodeIcon = workflowNodeIcons[node.type];
  return (
    <span
      className={[base, ring, "border-border bg-muted", className ?? ""].join(" ")}
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
