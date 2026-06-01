# 02 Server LangGraph Runtime Acceptance

## Validation Commands

- `pnpm --filter @ai-agent-workflow/server test`
- `pnpm --filter @ai-agent-workflow/server typecheck`
- `pnpm --filter @ai-agent-workflow/server lint`

## Manual Checks

- Server no longer returns deterministic mock LLM output for supported Start-to-LLM workflows.
- Required missing Start fields fail before any model call.
- Optional Start fields without values become `null`.
- Default Start values are used when run input omits the field.
- LLM prompt resolution uses namespaced state variables.
- Model response `text`, `usage`, and available `reasoning` are captured in node result data.
- Unsupported executable nodes produce clear failed runs rather than silent success.

## Acceptance Result

Status: Not reviewed.

Record reviewer, date, command results, and manual review conclusion.
