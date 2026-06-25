import { createDefaultWorkflow } from "@ai-agent-workflow/workflow-domain";
import { describe, expect, it } from "vitest";
import {
  CreateProviderKeyRequestSchema,
  CreateRunRequestSchema,
  CreateRunResponseSchema,
  CreateWorkflowRequestSchema,
  CreditStatusDtoSchema,
  EmailCapabilityResponseSchema,
  CreateTextKnowledgeDocumentRequestSchema,
  KnowledgeBaseSettingsSchema,
  KnowledgeNodeOutputDataSchema,
  ListKnowledgeBasesResponseSchema,
  ListKnowledgeDocumentsResponseSchema,
  ListProviderKeysResponseSchema,
  ListWorkflowsResponseSchema,
  apiPaths,
  createApiErrorResponse,
} from "@ai-agent-workflow/api-contracts";

describe("api contracts", () => {
  it("builds encoded REST paths", () => {
    expect(apiPaths.workflows()).toBe("/api/workflows");
    expect(apiPaths.workflow("workflow 1")).toBe("/api/workflows/workflow%201");
    expect(apiPaths.workflowRuns("workflow/1")).toBe("/api/workflows/workflow%2F1/runs");
    expect(apiPaths.run("run 1")).toBe("/api/runs/run%201");
    expect(apiPaths.runEvents("run/1")).toBe("/api/runs/run%2F1/events");
    expect(apiPaths.providerKeys()).toBe("/api/provider-keys");
    expect(apiPaths.providerKeyById("key/1")).toBe("/api/provider-keys/key%2F1");
    expect(apiPaths.knowledgeBases()).toBe("/api/knowledge-bases");
    expect(apiPaths.knowledgeBase("kb/1")).toBe("/api/knowledge-bases/kb%2F1");
    expect(apiPaths.knowledgeBaseDocuments("kb/1")).toBe("/api/knowledge-bases/kb%2F1/documents");
    expect(apiPaths.knowledgeBaseTextDocuments("kb/1")).toBe("/api/knowledge-bases/kb%2F1/documents/text");
    expect(apiPaths.knowledgeDocumentReindex("doc/1")).toBe("/api/knowledge-documents/doc%2F1/reindex");
    expect(apiPaths.credits()).toBe("/api/credits");
    expect(apiPaths.creditsApply()).toBe("/api/credits/apply");
    expect(apiPaths.emailCapability()).toBe("/api/email-capability");
  });

  it("validates knowledge base settings and list payloads", () => {
    const settings = KnowledgeBaseSettingsSchema.parse({});
    expect(settings).toMatchObject({
      embedding: { mode: "platform", provider: "openai", model: "text-embedding-3-small" },
      chunking: { strategy: "recursive", chunkSize: 800, chunkOverlap: 120 },
      retrieval: { mode: "semantic", topK: 5 },
    });

    const parsed = ListKnowledgeBasesResponseSchema.parse({
      knowledgeBases: [
        {
          id: "kb_customer_support_example",
          name: "云舵客服知识库",
          description: "中文客服演示知识库",
          visibility: "example",
          readOnly: true,
          settings,
          documentCount: 8,
          characterCount: 12000,
          createdAt: "2026-06-07T00:00:00.000Z",
          updatedAt: "2026-06-07T00:00:00.000Z",
        },
      ],
    });

    expect(parsed.knowledgeBases[0].readOnly).toBe(true);
  });

  it("validates knowledge documents and retrieval output data", () => {
    expect(CreateTextKnowledgeDocumentRequestSchema.safeParse({ title: "FAQ", content: "如何退款？" }).success).toBe(true);
    expect(CreateTextKnowledgeDocumentRequestSchema.safeParse({ title: "Huge", content: "x".repeat(100_001) }).success).toBe(false);

    expect(
      ListKnowledgeDocumentsResponseSchema.parse({
        documents: [
          {
            id: "doc1",
            knowledgeBaseId: "kb1",
            title: "退款规则",
            sourceType: "text",
            mimeType: "text/plain",
            parser: { type: "plainText", version: "1" },
            characterCount: 120,
            status: "queued",
            createdAt: "2026-06-07T00:00:00.000Z",
            updatedAt: "2026-06-07T00:00:00.000Z",
          },
        ],
      }).documents[0].status,
    ).toBe("queued");

    const output = KnowledgeNodeOutputDataSchema.parse({
      result: [
        {
          content: "退款需要在购买后 7 天内申请。",
          title: "退款规则",
          url: null,
          icon: null,
          metadata: { knowledgeBaseId: "kb1", documentId: "doc1", chunkId: "chunk1", score: 0.91 },
          files: [],
        },
      ],
      context: "退款需要在购买后 7 天内申请。",
      query: "如何退款？",
    });

    expect(output.result[0].metadata.score).toBe(0.91);
  });

  it("validates credit status payloads and the credits error codes", () => {
    expect(CreditStatusDtoSchema.safeParse({ status: "none" }).success).toBe(true);
    expect(
      CreditStatusDtoSchema.safeParse({ status: "approved", grantedTokens: 100_000, balanceTokens: 42 }).success,
    ).toBe(true);
    expect(createApiErrorResponse("credits_required", "x").error.code).toBe("credits_required");
    expect(createApiErrorResponse("credits_exhausted", "x").error.code).toBe("credits_exhausted");
  });

  it("requires provider, label, and apiKey to create a provider key", () => {
    expect(
      CreateProviderKeyRequestSchema.safeParse({ provider: "openai", label: "Work", apiKey: "sk-123" }).success,
    ).toBe(true);
    // Missing label or empty fields are rejected.
    expect(CreateProviderKeyRequestSchema.safeParse({ provider: "openai", apiKey: "sk-123" }).success).toBe(false);
    expect(
      CreateProviderKeyRequestSchema.safeParse({ provider: "openai", label: "", apiKey: "sk-123" }).success,
    ).toBe(false);
  });

  it("parses a provider key list carrying ids and labels", () => {
    const parsed = ListProviderKeysResponseSchema.parse({
      keys: [{ id: "k1", provider: "openai", label: "Work", last4: "1234", hasKey: true }],
    });
    expect(parsed.keys[0]).toMatchObject({ id: "k1", label: "Work", provider: "openai" });
  });

  it("accepts a workflow create payload using the domain schema", () => {
    const payload = { workflow: createDefaultWorkflow() };

    expect(CreateWorkflowRequestSchema.parse(payload).workflow?.version).toBe("1");
  });

  it("validates workflow summaries", () => {
    const response = {
      workflows: [
        {
          id: "workflow-1",
          name: "Demo",
          icon: "sparkles",
          updatedAt: "2026-06-01T00:00:00.000Z",
          nodeCount: 2,
          edgeCount: 1,
        },
      ],
    };

    expect(ListWorkflowsResponseSchema.parse(response).workflows).toHaveLength(1);
  });

  it("validates workflow run responses with null input and structured node data", () => {
    const response = {
      run: {
        id: "run-1",
        workflowId: "workflow-1",
        status: "succeeded",
        input: { topic: "contracts", audience: null },
        output: {
          summary: "Workflow run completed for Demo.",
          nodeResults: [
            {
              nodeId: "start1",
              label: "Start",
              status: "succeeded",
              output: "Start inputs materialized.",
              data: { topic: "contracts", audience: null },
            },
          ],
        },
        error: null,
        createdAt: "2026-06-01T00:00:00.000Z",
        startedAt: "2026-06-01T00:00:01.000Z",
        completedAt: "2026-06-01T00:00:02.000Z",
      },
    };

    expect(CreateRunResponseSchema.parse(response).run.status).toBe("succeeded");
  });

  it("accepts transient model provider settings on run requests", () => {
    const parsed = CreateRunRequestSchema.parse({
      input: { topic: "contracts" },
      modelProvider: {
        provider: "deepseek",
        baseURL: "https://api.deepseek.com",
        model: "deepseek-chat",
        apiKey: "secret",
      },
      modelProviderKeys: {
        openai: "openai-secret",
      },
    });

    expect(parsed.modelProvider?.apiKey).toBe("secret");
    expect(parsed.modelProviderKeys?.openai).toBe("openai-secret");
  });

  it("creates normalized API errors", () => {
    expect(createApiErrorResponse("not_found", "Missing workflow")).toEqual({
      error: {
        code: "not_found",
        message: "Missing workflow",
      },
    });
  });

  it("validates the public email capability payload", () => {
    const parsed = EmailCapabilityResponseSchema.parse({
      email: {
        configured: true,
        eligible: true,
        available: true,
        reason: null,
        limits: { userMinute: 10, userDay: 100, platformDay: 80, platformMonth: 2400 },
        remaining: { userMinute: 9, userDay: 99, platformDay: 79, platformMonth: 2399 },
        resets: {
          userMinute: "2026-06-24T12:01:00.000Z",
          day: "2026-06-25T00:00:00.000Z",
          month: "2026-07-01T00:00:00.000Z",
        },
      },
    });
    expect(parsed.email.limits.platformDay).toBe(80);
  });
});
