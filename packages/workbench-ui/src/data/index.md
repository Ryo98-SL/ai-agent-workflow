# Workbench Data Module Index

## Purpose

Data boundary and React Query hooks for the workbench UI.

## Structure

- `WorkbenchDataProvider.tsx` provides the injected `WorkbenchWorkflowApi`, the
  Better Auth client, and a shared React Query client.
- `useActiveWorkflowApi.ts` switches between the injected server API and the
  anonymous IndexedDB-backed workflow API.
- `localWorkflowStore.ts` owns anonymous workflow CRUD in IndexedDB. Run
  execution and all Knowledge Base calls still delegate to the server API.
- `anonymousRunStore.ts` tracks anonymous run ids for session-scoped history.
- `useWorkflows.ts` exposes workflow and run-history queries/mutations.
- `useAccount.ts` exposes session, provider-key, custom-model, and credits
  hooks.
- `useKnowledgeBases.ts` exposes Knowledge Base list/read/mutation hooks plus
  document create/delete/reindex hooks.

## Behavior

Anonymous users can manage workflows locally, run them through the server with
inline workflow definitions, and read the server-seeded example KB. Knowledge
Base mutations are not stored locally; they go through the workbench API
boundary and receive the server's auth/read-only errors.
