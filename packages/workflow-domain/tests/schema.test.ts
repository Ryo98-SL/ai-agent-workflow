import { describe, expect, it } from "vitest";
import {
  createDefaultWorkflow,
  createNode,
  createReadableNodeId,
  parseWorkflowJson,
  serializeWorkflowFile,
  validateWorkflowFile,
} from "@ai-agent-workflow/workflow-domain";

describe("workflow schema", () => {
  it("accepts the default workflow and includes the MVP node family", () => {
    const workflow = createDefaultWorkflow();
    const result = validateWorkflowFile(workflow);

    expect(result.ok).toBe(true);
    expect(workflow.graph.nodes.map((node) => node.type)).toEqual(["start", "llm"]);
    expect(workflow.graph.nodes.map((node) => node.id)).toContain("start1");
    expect(workflow.graph.nodes.map((node) => node.id)).toContain("llm1");
    expect(workflow.graph.nodes.every((node) => Boolean(node.description))).toBe(true);
    expect(workflow.settings.modelProvider).toMatchObject({
      provider: "ollama",
      baseURL: "http://127.0.0.1:11434",
      model: "qwen3.5:0.8b",
    });
  });

  it("accepts Start fields and rejects duplicate or invalid names", () => {
    const workflow = createDefaultWorkflow();
    const start = workflow.graph.nodes.find((node) => node.type === "start");

    expect(start?.config.fields).toEqual([
      {
        name: "topic",
        label: "Topic",
        required: true,
        defaultValue: "cat",
      },
    ]);

    if (start?.type === "start") {
      start.config.fields = [
        { name: "topic", required: true },
        { name: "topic", required: false },
      ];
    }

    const duplicate = validateWorkflowFile(workflow);
    expect(duplicate.ok).toBe(false);

    if (start?.type === "start") {
      start.config.fields = [{ name: "bad.name", required: false }];
    }

    const invalid = validateWorkflowFile(workflow);
    expect(invalid.ok).toBe(false);
  });

  it("creates readable collision-free node ids", () => {
    const workflow = createDefaultWorkflow();

    expect(createReadableNodeId("llm", workflow.graph.nodes)).toBe("llm2");
    expect(createNode("llm", { x: 0, y: 0 }, workflow.graph.nodes)).toMatchObject({
      id: "llm2",
      description: "Generate a response from the configured model.",
    });
  });

  it("rejects unsupported workflow versions", () => {
    const workflow = createDefaultWorkflow();
    const result = validateWorkflowFile({ ...workflow, version: "2" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("version");
    }
  });

  it("rejects malformed graph data", () => {
    const workflow = createDefaultWorkflow();
    const result = validateWorkflowFile({ ...workflow, graph: { nodes: [{ type: "llm" }], edges: [] } });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("id");
    }
  });

  it("parses valid JSON and normalizes invalid JSON errors", () => {
    expect(parseWorkflowJson(JSON.stringify(createDefaultWorkflow())).ok).toBe(true);
    const invalid = parseWorkflowJson("{nope");

    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.error).toContain("Invalid JSON");
    }
  });

  it("moves workflow API keys into the provider keyring during serialization", () => {
    const workflow = createDefaultWorkflow();
    workflow.settings.modelProvider = {
      provider: "deepseek",
      baseURL: "http://127.0.0.1:8787/v1",
      model: "mock-gpt",
      apiKey: "secret",
    };

    const serialized = serializeWorkflowFile(workflow);
    const parsed = JSON.parse(serialized) as { settings: { modelProvider: { apiKey?: string }; modelProviderKeys: { deepseek?: string } } };

    expect(parsed.settings.modelProvider.apiKey).toBeUndefined();
    expect(parsed.settings.modelProviderKeys.deepseek).toBe("secret");
  });
});
