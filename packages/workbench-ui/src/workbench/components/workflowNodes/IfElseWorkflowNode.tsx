import { Handle, Position } from "@xyflow/react";
import { AlertCircle, CheckCircle2, GitBranch, Variable } from "lucide-react";
import type { ConditionOperator, IfElseCase } from "@ai-agent-workflow/workflow-domain";
import type { WorkflowNodePaletteHandleType } from "../../types";
import {
  InnerHandle,
  PlusNode,
  workflowHandleClassName,
  type WorkflowNodeProps,
} from "./WorkflowNodeCardShell";
import { getIfElseRowLayout, ifElseLayout } from "./workflowNodeLayout";
import { workflowNodeIconBackgroundClassNames, workflowNodeIconClassName } from "./workflowNodeVisuals";

const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: "equals",
  notEquals: "not equals",
  contains: "contains",
  notContains: "not contains",
  isEmpty: "is empty",
  isNotEmpty: "is not empty",
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
};

const VALUELESS_OPERATORS = new Set<ConditionOperator>(["isEmpty", "isNotEmpty"]);

/** `{{llm1.text}}` → `llm1.text` for compact display on the card. */
function prettifyVariable(variable: string): string {
  const match = variable.trim().match(/^\{\{\s*(.+?)\s*\}\}$/);
  return (match ? match[1] : variable).trim();
}

export function IfElseWorkflowNode({ data, selected }: WorkflowNodeProps) {
  const node = data.node;
  if (node.type !== "ifElse") {
    return null;
  }
  const executionStatus = data.executionStatus;
  const rows = getIfElseRowLayout(node);
  const openPalette = (anchor: HTMLElement, sourceHandleId: string) => {
    data.onOpenNodePalette?.(node, "source" satisfies WorkflowNodePaletteHandleType, anchor, sourceHandleId);
  };

  return (
    <div
      className={[
        "relative rounded-md border bg-card text-card-foreground shadow-sm",
        selected ? "border-brand ring-2 ring-brand/20" : "border-border",
        executionStatus === "running" ? "ring-2 ring-brand animate-pulse" : "",
      ].join(" ")}
      style={{ width: ifElseLayout.width }}
      title={node.label}
    >
      {executionStatus === "succeeded" && (
        <CheckCircle2 size={14} className="absolute -right-1.5 -top-1.5 text-brand bg-card rounded-full" aria-hidden />
      )}
      {executionStatus === "failed" && (
        <AlertCircle size={14} className="absolute -right-1.5 -top-1.5 text-destructive bg-card rounded-full" aria-hidden />
      )}

      <Handle type="target" position={Position.Left} className={workflowHandleClassName}>
        <InnerHandle />
      </Handle>

      {/* Header */}
      <div className="flex items-center px-3" style={{ height: ifElseLayout.headerHeight }}>
        <span
          className={[
            "flex size-6 shrink-0 items-center justify-center rounded-md",
            workflowNodeIconBackgroundClassNames[node.type],
            workflowNodeIconClassName,
          ].join(" ")}
        >
          <GitBranch size={12} aria-hidden />
        </span>
        <p className="ml-2 truncate text-sm font-semibold">{node.label}</p>
      </div>

      {/* Case rows */}
      {node.config.cases.map((branch, index) => (
        <div
          key={branch.id}
          className="border-t border-border px-3 py-2"
          style={{ height: ifElseLayout.caseHeight }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {index === 0 ? "IF" : "ELSE IF"}
          </p>
          <CaseSummary branch={branch} />
        </div>
      ))}

      {/* Else row */}
      <div
        className="flex items-center border-t border-border px-3"
        style={{ height: ifElseLayout.elseHeight }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">ELSE</p>
      </div>

      {/* One source handle per branch row, aligned to its vertical center */}
      {rows.map((row) => (
        <Handle
          key={row.id}
          id={row.id}
          type="source"
          position={Position.Right}
          className={workflowHandleClassName}
          style={{ top: row.centerY }}
        >
          <PlusNode
            label={`Add node from ${node.label} ${row.label} branch`}
            onClick={(anchor) => openPalette(anchor, row.id)}
          />
          <InnerHandle />
        </Handle>
      ))}
    </div>
  );
}

function CaseSummary({ branch }: { branch: IfElseCase }) {
  const [first, ...rest] = branch.conditions;
  if (!first) {
    return <p className="mt-1 truncate text-xs italic text-muted-foreground/70">No conditions</p>;
  }

  const field = prettifyVariable(first.variable) || "—";
  const isValueless = VALUELESS_OPERATORS.has(first.operator);

  return (
    <div className="mt-1 space-y-0.5">
      <div className="flex items-center gap-1 text-xs">
        <Variable size={11} className="shrink-0 text-brand" aria-hidden />
        <span className="truncate font-medium text-foreground">{field}</span>
        {rest.length > 0 && (
          <span className="ml-auto shrink-0 rounded bg-muted px-1 text-[10px] text-muted-foreground">
            +{rest.length} {branch.combinator}
          </span>
        )}
      </div>
      <p className="truncate text-xs text-muted-foreground">{OPERATOR_LABELS[first.operator]}</p>
      {!isValueless && (
        <p className="truncate text-xs text-muted-foreground/80">{first.value || "—"}</p>
      )}
    </div>
  );
}
