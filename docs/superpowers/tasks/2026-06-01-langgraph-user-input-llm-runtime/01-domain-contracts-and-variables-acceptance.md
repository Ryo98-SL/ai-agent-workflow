# 01 Domain Contracts And Variables Acceptance

## Validation Commands

- `pnpm --filter @ai-agent-workflow/workflow-domain test`
- `pnpm --filter @ai-agent-workflow/api-contracts test`
- `pnpm --filter @ai-agent-workflow/workflow-domain typecheck`
- `pnpm --filter @ai-agent-workflow/api-contracts typecheck`

## Manual Checks

- New default workflows contain exactly one `start` node with readable id behavior.
- Existing empty Start configs remain accepted.
- Start field names reject dots and invalid identifiers.
- Namespaced references parse and resolve `{{nodeId.field}}` without accepting ambiguous unscoped variables.
- API contracts can represent optional Start values as `null` and node result structured metadata.
- LLM variable values are no longer required for runtime resolution.

## Acceptance Result

Status: Not reviewed.

Record reviewer, date, command results, and manual review conclusion.
