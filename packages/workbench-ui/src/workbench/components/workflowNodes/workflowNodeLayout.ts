import { Position } from "@xyflow/react";
import { IFELSE_ELSE_HANDLE_ID, type IfElseNode, type WorkflowNode, type WorkflowNodeType } from "@ai-agent-workflow/workflow-domain";

const defaultWorkflowNodeSize = {
  width: 184,
  height: 74,
};

const startWorkflowNodeSize = {
  width: 220,
  minHeight: 132,
};

const llmWorkflowNodeSize = {
  width: 220,
  minHeight: 112,
};

const workflowHandleBounds = {
  top: 20,
  width: 0,
  height: 0,
};

/**
 * If/Else card geometry. Each case block grows with its condition count, and
 * `getIfElseRowLayout` derives the exact vertical center of every branch so the
 * source handle lines up with its block. Shared by `getWorkflowNodeHandles`
 * (handle bounds) and the card renderer (explicit block heights), so they never
 * drift. All values are pixels.
 */
export const ifElseLayout = {
  width: 264,
  headerHeight: 46,
  caseLabelHeight: 20,
  conditionHeight: 44,
  connectorHeight: 18,
  noConditionHeight: 22,
  casePadTop: 8,
  casePadBottom: 10,
  elseHeight: 40,
};

/** Height of one case block, sized to fit its label + conditions exactly. */
export function ifElseCaseBlockHeight(branch: IfElseNode["config"]["cases"][number]): number {
  const count = branch.conditions.length;
  const conditionsHeight =
    count === 0
      ? ifElseLayout.noConditionHeight
      : count * ifElseLayout.conditionHeight + (count - 1) * ifElseLayout.connectorHeight;
  return ifElseLayout.casePadTop + ifElseLayout.caseLabelHeight + conditionsHeight + ifElseLayout.casePadBottom;
}

export type IfElseRowLayout = {
  /** Source-handle id (case id, or the reserved else id). */
  id: string;
  /** Branch label shown on the card: IF / ELSE IF / ELSE. */
  label: string;
  /** Block height in pixels (cases only; else uses `ifElseLayout.elseHeight`). */
  height: number;
  /** Vertical center of the block, relative to the card top. */
  centerY: number;
};

/** Ordered branch rows (cases then else) with their block heights and centers. */
export function getIfElseRowLayout(node: IfElseNode): IfElseRowLayout[] {
  const rows: IfElseRowLayout[] = [];
  let top = ifElseLayout.headerHeight;
  node.config.cases.forEach((branch, index) => {
    const height = ifElseCaseBlockHeight(branch);
    rows.push({ id: branch.id, label: index === 0 ? "IF" : "ELSE IF", height, centerY: top + height / 2 });
    top += height;
  });
  rows.push({ id: IFELSE_ELSE_HANDLE_ID, label: "ELSE", height: ifElseLayout.elseHeight, centerY: top + ifElseLayout.elseHeight / 2 });
  return rows;
}

export function getWorkflowNodeSize(node: WorkflowNode) {
  if (node.type === "ifElse") {
    const casesHeight = node.config.cases.reduce((sum, branch) => sum + ifElseCaseBlockHeight(branch), 0);
    const height = ifElseLayout.headerHeight + casesHeight + ifElseLayout.elseHeight;
    return { width: ifElseLayout.width, height };
  }

  if (node.type === "llm" || node.type === "agent") {
    const descriptionLineCount = node.description ? Math.ceil(node.description.length / 34) : 0;
    const height = Math.max(llmWorkflowNodeSize.minHeight, 96 + descriptionLineCount * 18);

    return {
      width: llmWorkflowNodeSize.width,
      height,
    };
  }

  if (node.type !== "start") {
    const descriptionLineCount = node.description ? Math.ceil(node.description.length / 28) : 0;
    const height = defaultWorkflowNodeSize.height + descriptionLineCount * 18;

    return {
      width: defaultWorkflowNodeSize.width,
      height,
    };
  }

  const fieldCount = node.config?.fields.length ?? 0;
  const descriptionLineCount = Math.max(1, Math.ceil((node.description?.length ?? 0) / 34));
  const height = Math.max(startWorkflowNodeSize.minHeight, 80 + fieldCount * 38 + descriptionLineCount * 18);

  return {
    width: startWorkflowNodeSize.width,
    height,
  };
}

export function getWorkflowNodeHandles(node: WorkflowNode) {
  const size = getWorkflowNodeSize(node);
  const sourceHandle = {
    id: null,
    type: "source" as const,
    position: Position.Right,
    x: size.width - workflowHandleBounds.width / 2,
    y: workflowHandleBounds.top - workflowHandleBounds.height / 2,
    width: workflowHandleBounds.width,
    height: workflowHandleBounds.height,
  };

  const targetHandle = {
    id: null,
    type: "target" as const,
    position: Position.Left,
    x: -1,
    y: workflowHandleBounds.top,
    width: workflowHandleBounds.width,
    height: workflowHandleBounds.height,
  };

  if (node.type === "start") {
    return [sourceHandle];
  }

  if (node.type === "end") {
    return [targetHandle];
  }

  if (node.type === "ifElse") {
    const sourceHandles = getIfElseRowLayout(node).map((row) => ({
      id: row.id,
      type: "source" as const,
      position: Position.Right,
      x: size.width - workflowHandleBounds.width / 2,
      y: row.centerY - workflowHandleBounds.height / 2,
      width: workflowHandleBounds.width,
      height: workflowHandleBounds.height,
    }));
    return [targetHandle, ...sourceHandles];
  }

  return [targetHandle, sourceHandle];
}

export function getWorkflowNodeCardClassName(type: WorkflowNodeType) {
  const sizeClassName = type === "start" || type === "llm" || type === "agent" ? "w-[220px]" : "w-[184px]";
  return `${sizeClassName} rounded-md border bg-card text-card-foreground p-3 shadow-sm`;
}
