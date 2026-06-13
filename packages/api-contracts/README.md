# API Contracts

Shared REST paths, Zod schemas, DTO types, run input/output contracts, SSE event
contracts, and normalized error shapes for the workflow API.

Consumers import from `@ai-agent-workflow/api-contracts` and validate data with
the exported schemas before crossing package boundaries.

Run inputs accept string or `null` values. Run requests may include inline
workflow payloads, Chat Mode query/conversation ids, transient model-provider
settings, provider keyring values, and a stored provider-key id for execution.
Runs can pause with a Human Input interrupt and resume with an action payload.
Node results can include structured `data` metadata alongside display output,
and live progress is represented with discriminated SSE event schemas.

Knowledge Base contracts cover reusable KB resources, text/file document
ingestion metadata, document indexing statuses, platform-managed embedding
settings, and Dify-style Knowledge node retrieval output data. Account
contracts cover encrypted provider-key metadata, custom models, and one-time AI
credit grants.
