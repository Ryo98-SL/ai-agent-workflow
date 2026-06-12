import { describe, expect, it } from "vitest";
import type { WorkflowFile } from "@ai-agent-workflow/workflow-domain";
import { createInMemoryWorkflowRepository, normalizeStoredWorkflow } from "../src/workflows/repository";

// A workflow stored in the legacy LLM shape (`{ systemPrompt, userPrompt }`, no
// `messages[]`) — what older saved workflows look like in the DB. Running such a
// document without normalizing crashed the LLM node with `reading 'map'`.
const legacyDocument = {
  version: "1",
  metadata: { name: "legacy", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  graph: {
    nodes: [
      { id: "start1", type: "start", label: "Start", position: { x: 0, y: 0 }, config: { fields: [] } },
      {
        id: "llm1",
        type: "llm",
        label: "LLM",
        position: { x: 1, y: 0 },
        config: { systemPrompt: "You are helpful.", userPrompt: "Say hi.", temperature: 0.7, maxTokens: 50, memory: false },
      },
    ],
    edges: [{ id: "e1", source: "start1", target: "llm1" }],
  },
  settings: {
    modelProvider: { provider: "ollama", baseURL: "http://127.0.0.1:11434", model: "qwen3.5:0.8b" },
    modelProviderKeys: {},
    providerKeyPrefs: {},
  },
};

describe("normalizeStoredWorkflow", () => {
  it("migrates a legacy LLM document to messages[] so it can run", () => {
    const workflow = normalizeStoredWorkflow("wf-legacy", legacyDocument);
    const llm = workflow.graph.nodes.find((node) => node.type === "llm");
    expect(llm?.type).toBe("llm");
    if (llm?.type === "llm") {
      expect(Array.isArray(llm.config.messages)).toBe(true);
      expect(llm.config.messages).toEqual([
        { role: "system", content: "You are helpful." },
        { role: "user", content: "Say hi." },
      ]);
    }
  });

  it("returns the raw value for a genuinely invalid document instead of throwing", () => {
    const broken = { not: "a workflow" };
    expect(() => normalizeStoredWorkflow("wf-broken", broken)).not.toThrow();
  });
});

describe("createInMemoryWorkflowRepository normalization", () => {
  it("normalizes legacy stored documents on get()", async () => {
    const repo = createInMemoryWorkflowRepository({
      id: "wf-1",
      userId: "user-1",
      // Cast: the store mirrors the DB, which can hold pre-migration documents.
      workflow: legacyDocument as unknown as WorkflowFile,
    });
    const dto = await repo.get("user-1", "wf-1");
    const llm = dto?.workflow.graph.nodes.find((node) => node.type === "llm");
    if (llm?.type === "llm") {
      expect(llm.config.messages.length).toBe(2);
    } else {
      throw new Error("expected an llm node");
    }
  });
});
