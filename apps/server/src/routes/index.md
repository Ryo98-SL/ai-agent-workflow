# Routes Module Index

## Purpose

`apps/server/src/routes` contains focused Hono route modules mounted by
`src/app.ts`.

## Structure

- `account.ts` manages authenticated provider keys and custom model records.
- `credits.ts` exposes AI credit status and application endpoints.
- `knowledge.ts` exposes Knowledge Base and Knowledge Document APIs.

## Behavior

Route modules validate request bodies with `@ai-agent-workflow/api-contracts`
schemas and return normalized API errors. Account and credit routes require a
resolved Better Auth user. Knowledge routes allow anonymous reads of the seeded
example KB, while all KB mutations require an authenticated owner.

Provider keys and platform credit keys are encrypted server-side; routes only
return labels, provider ids, and masked `last4` metadata.
