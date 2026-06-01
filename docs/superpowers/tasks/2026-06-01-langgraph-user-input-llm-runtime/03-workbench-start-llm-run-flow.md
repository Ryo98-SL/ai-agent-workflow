# 03 Workbench Start LLM Run Flow

## Goal

Update the workbench so users can configure Start input fields, inspect immutable node ids, see LLM variable references, and run the complete workflow through the server.

## Preconditions

- Read `01-domain-contracts-and-variables-handoff.md`.
- Read `02-server-langgraph-runtime-handoff.md` if available; if Task 02 is still in review, rely only on finalized shared contracts from Task 01.
- Preserve existing workbench layout and server-backed save/load behavior.

## Scope

- Add a Start inspector variant for field list editing.
- Show read-only node ids in Start and LLM inspectors.
- Remove editable LLM prompt variable value inputs.
- Show auto-detected LLM variable references and simple resolution status.
- Prevent adding a second Start node from the palette.
- Change Run controls from selected-node execution to workflow-level execution.
- Render Start field inputs in the run panel and submit them to `createRun`.
- Update DebugPanel/Run Log copy and tests to describe workflow runs.

## Non-Goals

- Do not add selected-node testing.
- Do not add visual graph validation beyond the lightweight UI states needed for this feature.
- Do not implement file or image input controls.
- Do not redesign the workbench shell or canvas.

## Outputs

- Start inspector component or variant.
- Updated LLM inspector variable display.
- Updated NodePalette, WorkbenchLayout, DebugPanel, and AppWorkbench run flow.
- Workbench tests for Start field editing, variable display, Start uniqueness, and workflow-level run submission.

## Handoff Document

Update `03-workbench-start-llm-run-flow-handoff.md` when complete.

## Acceptance Document

Reviewer follows `03-workbench-start-llm-run-flow-acceptance.md`.
