# 03 Workbench Start LLM Run Flow Acceptance

## Validation Commands

- `pnpm --filter @ai-agent-workflow/workbench-ui test`
- `pnpm --filter @ai-agent-workflow/workbench-ui typecheck`
- `pnpm --filter @ai-agent-workflow/workbench-ui lint`

## Manual Checks

- Start inspector can add, remove, and edit text input fields.
- Start and LLM inspectors show read-only node ids.
- LLM inspector displays prompt references without editable variable value inputs.
- Palette prevents a second Start node.
- Run button and Run Log are workflow-level, not selected-node test UI.
- Run panel renders Start fields and submits values through the workflow API.

## Acceptance Result

Status: Not reviewed.

Record reviewer, date, command results, and manual review conclusion.
