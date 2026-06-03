# API Contracts

Shared REST paths, Zod schemas, DTO types, run input/output contracts, and
normalized error shapes for the workflow API.

Consumers import from `@ai-agent-workflow/api-contracts` and validate data with
the exported schemas before crossing package boundaries.

Run inputs accept string or `null` values, run requests may include transient
model provider settings for execution, and node results can include structured
`data` metadata alongside display output.
