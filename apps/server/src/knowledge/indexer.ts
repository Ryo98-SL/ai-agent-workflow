import { logger } from "../logger";
import { chunkKnowledgeText } from "./chunking";
import type { EmbeddingAdapter } from "./embeddings";
import type { KnowledgeRepository } from "./repository";

export type KnowledgeIndexingRunner = {
  start(): void;
  stop(): void;
  trigger(): void;
};

export type KnowledgeIndexingRunnerOptions = {
  repository: KnowledgeRepository;
  embedding: EmbeddingAdapter;
  concurrency?: number;
  intervalMs?: number;
  staleMs?: number;
};

export function createKnowledgeIndexingRunner({
  repository,
  embedding,
  concurrency = Number(process.env.KNOWLEDGE_INDEXER_CONCURRENCY || 1),
  intervalMs = 15_000,
  staleMs = 5 * 60_000,
}: KnowledgeIndexingRunnerOptions): KnowledgeIndexingRunner {
  let active = 0;
  let stopped = true;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const schedule = (delayMs: number) => {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void drain();
    }, delayMs);
  };

  const drain = async () => {
    if (stopped) return;
    while (active < Math.max(1, concurrency)) {
      const document = await repository.claimNextIndexingDocument(new Date(Date.now() - staleMs));
      if (!document) {
        schedule(intervalMs);
        return;
      }

      active += 1;
      void processDocument(document)
        .catch((error) => {
          logger.error("knowledge.indexing.unhandled_error", {
            documentId: document.id,
            message: error instanceof Error ? error.message : "indexing failed",
          });
        })
        .finally(() => {
          active -= 1;
          schedule(0);
        });
    }
  };

  const processDocument = async (document: Awaited<ReturnType<KnowledgeRepository["claimNextIndexingDocument"]>>) => {
    if (!document) return;
    try {
      await repository.markDocumentStatus(document.id, "chunking");
      const chunks = chunkKnowledgeText(document.rawText, {
        title: document.title,
        chunkSize: document.settings.chunking.chunkSize * 4,
        chunkOverlap: document.settings.chunking.chunkOverlap * 4,
      });
      await repository.markDocumentStatus(document.id, "embedding");
      const embeddings = await embedding.embedTexts(chunks.map((chunk) => chunk.content));
      await repository.replaceDocumentChunks(
        document,
        chunks.map((chunk, index) => ({
          ...chunk,
          embedding: embeddings[index],
          metadata: { ...chunk.metadata, mimeType: document.mimeType },
        })),
      );
      await repository.markDocumentStatus(document.id, "ready");
      logger.info("knowledge.indexing.completed", {
        documentId: document.id,
        knowledgeBaseId: document.knowledgeBaseId,
        chunkCount: chunks.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Indexing failed.";
      await repository.markDocumentStatus(document.id, "failed", message);
      logger.error("knowledge.indexing.failed", {
        documentId: document.id,
        knowledgeBaseId: document.knowledgeBaseId,
        message,
      });
    }
  };

  return {
    start() {
      if (!stopped) return;
      stopped = false;
      schedule(0);
    },
    stop() {
      stopped = true;
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
    },
    trigger() {
      if (stopped) {
        return;
      }
      schedule(0);
    },
  };
}
