import { Position } from "@xyflow/react";
import type { WorkflowNode, WorkflowNodeType } from "@ai-agent-workflow/workflow-domain";

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

export function getWorkflowNodeSize(node: WorkflowNode) {
  if (node.type === "llm") {
    const descriptionLineCount = node.description ? Math.ceil(node.description.length / 34) : 0;
    const height = Math.max(llmWorkflowNodeSize.minHeight, 96 + descriptionLineCount * 18);

    return {
      width: llmWorkflowNodeSize.width,
      height,
    };
  }

  if (node.type !== "start") {
    return defaultWorkflowNodeSize;
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

  return [targetHandle, sourceHandle];
}

export function getWorkflowNodeCardClassName(type: WorkflowNodeType) {
  const sizeClassName = type === "start" || type === "llm" ? "w-[220px]" : "w-[184px]";
  return `${sizeClassName} rounded-md border bg-card text-card-foreground p-3 shadow-sm`;
}
