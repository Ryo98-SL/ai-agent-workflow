# Workbench Components Index

## Purpose

This directory contains focused React components for the server-backed
workbench shell.

## Key Files

- `Button.tsx` centralizes workbench button styling, sizes, disabled states,
  and shared variants for icon controls, panel actions, model selector rows, and
  node palette items.
- `DebugPanel.tsx` handles workflow-level run controls, Start input values, and
  server run result rendering.
- `FloatingPanel.tsx` provides the shared floating panel frame used inside
  body-level popovers and inspector panels.
- `InlineNodePalettePopover.tsx` renders the node-handle anchored palette used
  by canvas PlusNode buttons and forwards palette selections back with
  direction-aware handle connection options. Target-handle palettes disable End
  because End nodes cannot feed into another node.
- `ModelSettingsPanel.tsx` edits provider-aware model settings inside the
  settings popover, with a body-level searchable DeepSeek/Ollama selector and
  in-memory API key entry for DeepSeek that is sent through run requests instead
  of saved workflow payloads.
- `NodeInspector.tsx` selects the inspector for the active node type when a node is selected.
- `NodePalette.tsx` adds schema nodes to the workflow from the palette popover
  and disables Start when the workflow already contains one, with optional
  per-palette disabled node types for handle-specific creation rules.
- `Popover.tsx` wraps `@floating-ui/react` positioning, dismissal, and
  `FloatingPortal` rendering so anchored workbench popovers are mounted under
  `body` instead of inside their layout containers. It supports both rendered
  trigger buttons and externally supplied reference elements for popovers
  anchored to controls inside ReactFlow nodes.
- `ProjectFileActions.tsx` provides new/open/save/save-as commands through
  callbacks from `AppWorkbench`.
- `WorkbenchLayout.tsx` renders the canvas-first shell, square-rounded palette
  and settings icon buttons, selection-driven inspector panel, top-right
  icon-only Run button, and anchored body-level popovers for node palette, model
  settings, and run log.
- `WorkflowCanvas.tsx` adapts persisted workflow nodes and workflow-backed edges
  into ReactFlow, including per-workflow-type nodeTypes, node selection, local
  controlled node data updates, live dragging, explicit node dimensions/handle
  bounds, fixed top-positioned handles for dynamic Start cards, Start
  input/description previews, larger connection handles, node-handle palette
  opening anchored to ReactFlow handle elements, direction-aware edge creation,
  and visible MiniMap node styling. The canvas
  synchronizes the active inspector node into ReactFlow selected state,
  preserves that selected outline across pane clicks, and clears it only when
  another node is selected or the inspector is closed. Node field and
  description edits update node data without viewport resets. Node
  Delete/Backspace removal updates the workflow graph, clears the inspector when
  the active node is removed, and drops edges attached to removed nodes. Edge
  selection stays local, while edge Delete/Backspace removal updates the
  workflow.
- `inspectors/` contains node-specific configuration forms.
- `workflowNodes/` contains one ReactFlow node component per workflow node type,
  the shared card shell, icon bindings, and node layout constants.
