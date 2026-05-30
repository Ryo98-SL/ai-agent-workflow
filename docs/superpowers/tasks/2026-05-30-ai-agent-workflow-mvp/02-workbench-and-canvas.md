# 02 Workbench and Canvas

## Goal

Build the Dify/Coze-style workbench shell and ReactFlow canvas around the workflow schema from Task 01.

## Preconditions

- Read `01-project-foundation-and-schema-handoff.md`.
- Workflow schema and prompt utilities from Task 01 are available.
- Development, lint, typecheck, and test scripts are available.

## Scope

- Build `AppWorkbench` with left node palette, center canvas, right inspector, and bottom debug panel regions.
- Integrate ReactFlow for node rendering, selection, dragging, zooming, and edge creation.
- Build `NodePalette` with `Start`, `LLM`, `Knowledge`, `Tool`, `Code`, `If/Else`, `Template`, and `End`.
- Build basic node renderers with stable visual sizing and readable labels.
- Build `NodeInspector` routing by selected node type.
- Build initial `LLMInspector` form fields for prompts, variables, temperature, max tokens, and optional per-node model override.
- Build placeholder inspectors for non-LLM nodes that clearly show unsupported or future configuration status.
- Build initial `DebugPanel` visual states without real execution.
- Add component tests for inspector selection and LLM form updates.

## Non-Goals

- Do not call real model APIs.
- Do not implement file open/save.
- Do not implement full workflow execution.
- Do not implement custom knowledge base, code execution, or HTTP tools.

## Outputs

- Workbench UI components.
- ReactFlow canvas wired to workflow schema state.
- Node palette and basic node renderers.
- LLM inspector that updates selected node config.
- Debug panel placeholder states.
- Component tests for key UI state transitions.

## Handoff Document

Update `02-workbench-and-canvas-handoff.md` when complete.

## Acceptance Document

Reviewer follows `02-workbench-and-canvas-acceptance.md`.

