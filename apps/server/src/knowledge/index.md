# Knowledge Module Index

## Purpose

`apps/server/src/knowledge` owns server-side Knowledge Base persistence,
example data, text chunking, embedding, and indexing orchestration.

## Structure

- `constants.ts` defines shared KB limits, parser version, default settings, and
  re-exports the example KB id (`EXAMPLE_KNOWLEDGE_BASE_ID`) from
  `@ai-agent-workflow/workflow-domain` so storage and the demo fixture share one
  source of truth.
- `example.ts` contains the seeded Chinese customer-support KB fixture.
- `chunking.ts` normalizes plain text/markdown and splits it into deterministic
  chunks.
- `embeddings.ts` exposes the platform embedding adapter plus a deterministic
  adapter for tests.
- `repository.ts` defines the KB repository interface and Prisma/in-memory
  implementations, including ready-chunk counting and semantic vector search.
- `indexer.ts` runs queued document indexing in-process with bounded
  concurrency.

## Behavior

Authenticated users can own private KBs. Anonymous users can read the seeded
example KB only. MVP ingestion supports pasted text and text-like files; PDF,
DOCX, webpage ingestion, user-managed embedding providers, and hybrid retrieval
are intentionally deferred. Runtime retrieval searches only readable KBs and
documents marked `ready`, returning segment metadata plus source-delimited
context for downstream prompts.
