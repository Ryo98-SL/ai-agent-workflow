import { createDefaultWorkflow } from "@ai-agent-workflow/workflow-domain";
import { describe, expect, it } from "vitest";
import {
  CreateProviderKeyRequestSchema,
  CreateRunRequestSchema,
  CreateRunResponseSchema,
  CreateWorkflowRequestSchema,
  CreditStatusDtoSchema,
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
    expect(apiPaths.credits()).toBe("/api/credits");
    expect(apiPaths.creditsApply()).toBe("/api/credits/apply");
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
});
