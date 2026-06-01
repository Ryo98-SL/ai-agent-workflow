# 04 Acceptance Hardening Acceptance

## Validation Commands

- `pnpm --filter @ai-agent-workflow/workflow-domain test`
- `pnpm --filter @ai-agent-workflow/api-contracts test`
- `pnpm --filter @ai-agent-workflow/server test`
- `pnpm --filter @ai-agent-workflow/workbench-ui test`
- `pnpm typecheck`
- `pnpm test`
- `pnpm lint`
- `pnpm build`

## Manual Checks

- A user can configure a Start field, reference it from an LLM prompt as `{{start1.fieldName}}`, and run the whole workflow.
- The server run uses LangGraph and real OpenAI-compatible LLM calls for supported workflows.
- Run output includes node results and events for the whole workflow.
- Required, defaulted, and optional null Start input semantics match the spec.
- All handoff documents in the chain are complete.
- All acceptance documents in the chain record reviewer, date, command results, and manual conclusion.

## Acceptance Result

Status: Not reviewed.

Record reviewer, date, command results, and manual review conclusion.
