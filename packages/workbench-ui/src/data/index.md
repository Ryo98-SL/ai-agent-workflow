# Workbench Data Module Index

## Purpose

Data boundary and React Query hooks for the workbench UI.

## Structure

- `WorkbenchDataProvider.tsx` provides the injected `WorkbenchWorkflowApi`, the
  Better Auth client, a shared React Query client, and a refresh nonce used
  after local-data import.
- `authClient.ts` creates the Better Auth browser client with credentialed
  requests against the API/auth origin.
- `useActiveWorkflowApi.ts` switches between the injected server API and the
  anonymous IndexedDB-backed workflow API after session state resolves.
- `localWorkflowStore.ts` owns anonymous workflow CRUD in IndexedDB, migrates
  legacy localStorage data, sends inline workflows for server execution, and
  delegates account/KB/credit calls to the server API.
- `anonymousRunStore.ts` tracks anonymous run ids for session-scoped history and
  drops ids when server memory can no longer read them.
- `useWorkflows.ts` exposes workflow and run-history queries/mutations.
- `useAccount.ts` exposes session, provider-key, custom-model, and credits
  hooks.
- `useKnowledgeBases.ts` exposes Knowledge Base list/read/mutation hooks plus
  document create/delete/reindex hooks.

## Behavior

Anonymous users can manage workflows locally, run them through the server with
inline workflow definitions, resume Human Input runs, and read the
server-seeded example KB. Knowledge Base mutations, provider keys, custom
models, and credits are not stored locally; they go through the workbench API
boundary and receive the server's auth/read-only errors.
