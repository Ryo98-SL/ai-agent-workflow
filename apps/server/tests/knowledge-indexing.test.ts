import { describe, expect, it } from "vitest";
import { chunkKnowledgeText } from "../src/knowledge/chunking";
import { createDeterministicEmbeddingAdapter } from "../src/knowledge/embeddings";
import { createKnowledgeIndexingRunner } from "../src/knowledge/indexer";
import { createInMemoryKnowledgeRepository } from "../src/knowledge/repository";

async function waitForReady(repository: ReturnType<typeof createInMemoryKnowledgeRepository>, knowledgeBaseId: string) {
  const started = Date.now();
  while (Date.now() - started < 1000) {
    const documents = await repository.listDocuments("user-1", knowledgeBaseId);
    const [document] = documents ?? [];
    if (document?.status === "ready" || document?.status === "failed") {
      return document;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Document did not finish indexing.");
}

describe("knowledge indexing", () => {
  it("chunks text deterministically", () => {
    const chunks = chunkKnowledgeText("一".repeat(500), {
      title: "测试",
      chunkSize: 12,
      chunkOverlap: 2,
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toMatchObject({ ordinal: 0, title: "测试" });
  });

  it("indexes queued text documents with deterministic embeddings", async () => {
    const repository = createInMemoryKnowledgeRepository();
    await repository.ensureExampleKnowledgeBase();
    const knowledgeBase = await repository.create("user-1", { name: "测试知识库" });
    const document = await repository.createTextDocument("user-1", knowledgeBase.id, {
      title: "退款规则",
      content: "购买后七天内可以申请退款。若已经开具发票，需要先处理发票。",
      mimeType: "text/plain",
    });
    expect(document?.status).toBe("queued");

    const runner = createKnowledgeIndexingRunner({
      repository,
      embedding: createDeterministicEmbeddingAdapter(),
      intervalMs: 1000,
    });
    runner.start();
    runner.trigger();

    const ready = await waitForReady(repository, knowledgeBase.id);
    runner.stop();

    expect(ready.status).toBe("ready");
  });
});
