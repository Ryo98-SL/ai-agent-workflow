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
 * If/Else card geometry. Shared by `getWorkflowNodeHandles` (handle bounds) and
 * the card renderer (CSS row positions) so branch handles always line up with
 * their condition rows.
 */
export const ifElseLayout = {
  width: 240,
  headerHeight: 48,
  caseHeight: 70,
  elseHeight: 38,
};

export type IfElseRowLayout = {
  /** Source-handle id (case id, or the reserved else id). */
  id: string;
  /** Branch label shown on the card: IF / ELSE IF / ELSE. */
  label: string;
  /** Vertical center of the row, relative to the card top. */
  centerY: number;
};

/** Ordered branch rows (cases then else) with their vertical centers. */
export function getIfElseRowLayout(node: IfElseNode): IfElseRowLayout[] {
  const rows: IfElseRowLayout[] = node.config.cases.map((branch, index) => ({
    id: branch.id,
    label: index === 0 ? "IF" : "ELSE IF",
    centerY: ifElseLayout.headerHeight + index * ifElseLayout.caseHeight + ifElseLayout.caseHeight / 2,
  }));
  const elseCenterY =
    ifElseLayout.headerHeight + node.config.cases.length * ifElseLayout.caseHeight + ifElseLayout.elseHeight / 2;
  rows.push({ id: IFELSE_ELSE_HANDLE_ID, label: "ELSE", centerY: elseCenterY });
  return rows;
}

export function getWorkflowNodeSize(node: WorkflowNode) {
  if (node.type === "ifElse") {
    const caseCount = node.config.cases.length;
    const height = ifElseLayout.headerHeight + caseCount * ifElseLayout.caseHeight + ifElseLayout.elseHeight;
    return { width: ifElseLayout.width, height };
  }

  if (node.type === "llm") {
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
  const sizeClassName = type === "start" || type === "llm" ? "w-[220px]" : "w-[184px]";
  return `${sizeClassName} rounded-md border bg-card text-card-foreground p-3 shadow-sm`;
}
