# Email Module Index

## Purpose

`apps/server/src/email` owns safe real-email delivery. Dry-run composition stays
inside the workflow Tool runtime; this module protects every outbound Resend
request with authentication, persistent quota reservation, and idempotency.

## Structure

- `limits.ts` defines fixed user and platform ceilings plus UTC window helpers.
- `repository.ts` implements Prisma and in-memory attempt repositories.
- `service.ts` performs fail-closed reservation, duplicate suppression, provider
  dispatch, final status updates, and public capability snapshots.
- `resend.ts` builds the env-gated Resend adapter with a bounded timeout.
- `types.ts` defines delivery, repository, attempt, quota, and error contracts.

## Behavior

Real sends require an authenticated user and a unique delivery identity. The
repository transaction checks user and platform usage, then writes a reservation
before Resend is contacted. Failed or uncertain provider calls keep consuming
that reservation and are never retried automatically. Database failures prevent
sending. Platform ceilings are fixed at 80 attempts per UTC day and 2,400 per
UTC month so the application stays below Resend's documented free allowance.
