# Workflow Nodes Index

## Purpose

This directory owns ReactFlow node components for persisted workflow node types.
Each workflow node type has its own component entry so type-specific styling,
icons, and future behavior can evolve independently.

## Key Files

- `StartWorkflowNode.tsx`, `LlmWorkflowNode.tsx`, `KnowledgeWorkflowNode.tsx`,
  `ToolWorkflowNode.tsx`, `CodeWorkflowNode.tsx`, `IfElseWorkflowNode.tsx`,
  `TemplateWorkflowNode.tsx`, and `EndWorkflowNode.tsx` bind node types to
  their title icons.
- `WorkflowNodeCardShell.tsx` renders the shared node card structure, title
  icon slot, label/type text, ReactFlow source/target handles, and PlusNode
  buttons that ask the canvas to open a node palette anchored to the clicked
  handle. It can suppress target handles for Start nodes and source handles for
  End nodes.
- `StartWorkflowNode.tsx` extends the shared card with light-mode input
  declaration rows and a natural-height node description preview.
- `workflowNodeLayout.ts` centralizes ReactFlow node dimensions and handle
  bounds used by `WorkflowCanvas.tsx`, including the taller Start card size and
  Start/End handle availability.
- `workflowNodeVisuals.ts` centralizes per-node-type icon background colors and
  white icon foreground styling shared with the node palette.
- `index.ts` re-exports node components and layout constants for the canvas.

## Runtime Behavior

`WorkflowCanvas.tsx` maps persisted workflow node `type` values directly to
ReactFlow `nodeTypes`. The current type-specific components share the same card
JSX through `WorkflowNodeCardShell`, but each component is a separate extension
point with its own icon. Handle PlusNode buttons stop ReactFlow drag/connect
gestures before asking the canvas to open the inline node palette with the
underlying handle as the popover anchor. Source handle additions create
outgoing edges from the clicked node, while target handle additions create
incoming edges into the clicked node. Start nodes display each declared input
field, required status, and node-level description on the canvas.
