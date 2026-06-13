# Workflow Nodes Index

## Purpose

ReactFlow node components for persisted workflow node types.

## Key Files

- `WorkflowNodeCardShell.tsx` provides the shared card, icon slot, title,
  default type/description body, handles, and handle-anchored Plus buttons.
- `StartWorkflowNode.tsx` previews declared inputs and description.
- `LlmWorkflowNode.tsx` shows the effective model, provider logo, and model
  capability icons supplied by the canvas after resolving node overrides over
  workflow defaults, then renders the node description when present.
- `KnowledgeWorkflowNode.tsx` previews the selected KB label, query template,
  and top-K retrieval setting supplied by the Knowledge node config.
- `ToolWorkflowNode.tsx` previews the bound tool descriptor and primary params
  with variable chips where applicable.
- `IfElseWorkflowNode.tsx` previews case/else branch handles and conditions.
- `HumanInputWorkflowNode.tsx` previews the reviewer prompt and waiting state.
- `TemplateWorkflowNode.tsx` previews the template text.
- Other node files bind schema node types to icons and shared shell behavior.
- `workflowNodeLayout.ts` centralizes ReactFlow node dimensions and handle
  bounds, including dynamic Start/LLM sizing and Start/End handle availability.
- `workflowNodeVisuals.ts` centralizes per-node-type icon background colors and
  icon foreground styling shared with the node palette.
- `index.ts` re-exports node components and layout constants for the canvas.

## Runtime Behavior

Persisted node `type` values map directly to ReactFlow `nodeTypes`. Handle Plus
buttons stop drag/connect gestures before opening the inline palette. Source
handles create outgoing edges; target handles create incoming edges. Start has
no target handle, End has no source handle, If/Else exposes one source handle
per case plus `else`, and target-handle palettes disable End.
