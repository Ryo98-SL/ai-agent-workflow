# 03 LLM Debug Runtime Acceptance

## Validation Commands

- `npm run typecheck`
- `npm run test`
- `npm run lint`

## Manual Checks

- Configure an OpenAI-compatible mock endpoint and model.
- Run an LLM node with a prompt and test variables.
- Confirm the debug panel shows resolved prompt, request summary, response text, latency, and success state.
- Trigger a missing-variable error and confirm the error is clear and normalized.
- Trigger a mock auth or server error and confirm the debug panel preserves useful request/response detail.
- Confirm React components do not directly contain provider-specific fetch logic.

## Acceptance Result

Status: Not reviewed.

Record reviewer, date, command results, and manual review conclusion.

