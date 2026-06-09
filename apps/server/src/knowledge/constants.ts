import type { KnowledgeBaseSettings } from "@ai-agent-workflow/api-contracts";

// Single source of truth: the demo workflow fixture and KB storage share this id.
export { EXAMPLE_KNOWLEDGE_BASE_ID } from "@ai-agent-workflow/workflow-domain";

export const KNOWLEDGE_DOCUMENTS_PER_BASE_LIMIT = 20;
export const KNOWLEDGE_DOCUMENT_CHAR_LIMIT = 100_000;
export const KNOWLEDGE_ACCOUNT_CHAR_LIMIT = 500_000;

export const DEFAULT_KNOWLEDGE_BASE_SETTINGS: KnowledgeBaseSettings = {
  embedding: {
    mode: "platform",
    provider: "openai",
    model: "text-embedding-3-small",
    providerKeyId: null,
  },
  chunking: {
    strategy: "recursive",
    chunkSize: 800,
    chunkOverlap: 120,
  },
  retrieval: {
    mode: "semantic",
    topK: 5,
    scoreThreshold: 0.3,
  },
};

export const KNOWLEDGE_PARSER_VERSION = "1";
