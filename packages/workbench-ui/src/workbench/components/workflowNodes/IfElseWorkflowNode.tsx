import { Fragment } from "react";
import { Handle, Position } from "@xyflow/react";
import { AlertCircle, CheckCircle2, GitBranch } from "lucide-react";
import { conditionOperatorLabel, isValuelessOperator, type ConditionRow, type IfElseCase } from "@ai-agent-workflow/workflow-domain";
import type { WorkflowNodePaletteHandleType } from "../../types";
import { VariableTag } from "../VariableTag";
import { WorkflowNodeActionsMenu } from "../WorkflowNodeActionsMenu";
import { InnerHandle, PlusNode, workflowHandleClassName, type WorkflowNodeProps } from "./WorkflowNodeCardShell";
import { getIfElseRowLayout, ifElseCaseBlockHeight, ifElseLayout } from "./workflowNodeLayout";
import { workflowNodeIconBackgroundClassNames, workflowNodeIconClassName } from "./workflowNodeVisuals";

const branchHandleClassName = "!size-4 group !bg-transparent !border-none";

function conditionPredicate(condition: ConditionRow): string {
  const operator = conditionOperatorLabel(condition.operator);
  if (isValuelessOperator(condition.operator)) {
    return operator;
  }
  return `${operator} ${condition.value || "—"}`;
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
        "group/card relative rounded-md border bg-card text-card-foreground shadow-sm",
        selected ? "border-brand ring-2 ring-brand/20" : "border-border",
        executionStatus === "running" ? "ring-2 ring-brand animate-pulse" : "",
      ].join(" ")}
      style={{ width: ifElseLayout.width }}
      title={node.label}
    >
      {data.onNodeAction && (
        <WorkflowNodeActionsMenu node={node} selected={selected} onNodeAction={data.onNodeAction} />
      )}
      {executionStatus === "succeeded" && (
        <CheckCircle2 size={14} className="absolute -right-1.5 -top-1.5 rounded-full bg-card text-brand" aria-hidden />
      )}
      {executionStatus === "failed" && (
        <AlertCircle size={14} className="absolute -right-1.5 -top-1.5 rounded-full bg-card text-destructive" aria-hidden />
      )}

      {/* Target handle sits at the header level (top), matching its bound and the
          incoming edge — not the card's vertical center. */}
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

      {/* Case blocks — each sized to fit its conditions exactly */}
      {node.config.cases.map((branch, index) => (
        <div
          key={branch.id}
          className="border-t border-border px-3"
          style={{
            height: ifElseCaseBlockHeight(branch),
            paddingTop: ifElseLayout.casePadTop,
            paddingBottom: ifElseLayout.casePadBottom,
          }}
        >
          <BranchLabel>{index === 0 ? "IF" : "ELSE IF"}</BranchLabel>
          <CaseConditions branch={branch} />
        </div>
      ))}

      {/* Else block */}
      <div
        className="flex items-center justify-end border-t border-border px-3"
        style={{ height: ifElseLayout.elseHeight }}
      >
        <BranchLabel>ELSE</BranchLabel>
      </div>

      {/* One source handle per branch, centered on its block */}
      {rows.map((row) => (
        <Handle
          key={row.id}
          id={row.id}
          type="source"
          position={Position.Right}
          className={branchHandleClassName}
          // Only override `top`; keep ReactFlow's default transform so the
          // handle still straddles (sits half-outside) the right border.
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

function BranchLabel({ children }: { children: string }) {
  return (
    <div
      className="flex items-center justify-end text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
      style={{ height: ifElseLayout.caseLabelHeight }}
    >
      {children}
    </div>
  );
}

function CaseConditions({ branch }: { branch: IfElseCase }) {
  if (branch.conditions.length === 0) {
    return (
      <div
        className="flex items-center text-xs italic text-muted-foreground/70"
        style={{ height: ifElseLayout.noConditionHeight }}
      >
        No conditions
      </div>
    );
  }

  return (
    <>
      {branch.conditions.map((condition, index) => (
        <Fragment key={index}>
          {index > 0 && (
            <div
              className="flex items-center justify-end"
              style={{ height: ifElseLayout.connectorHeight }}
            >
              <span className="rounded bg-muted px-1.5 text-[9px] font-semibold uppercase leading-4 tracking-wide text-muted-foreground">
                {branch.combinator}
              </span>
            </div>
          )}
          <div
            className="flex flex-col justify-center gap-0.5 overflow-hidden"
            style={{ height: ifElseLayout.conditionHeight }}
          >
            <div className="flex">
              {condition.variable ? (
                <VariableTag reference={condition.variable} />
              ) : (
                <span className="inline-flex items-center rounded border border-dashed border-border px-1 py-0.5 text-[11px] text-muted-foreground/70">
                  未选择变量
                </span>
              )}
            </div>
            <p className="truncate text-[11px] text-muted-foreground">{conditionPredicate(condition)}</p>
          </div>
        </Fragment>
      ))}
    </>
  );
}
