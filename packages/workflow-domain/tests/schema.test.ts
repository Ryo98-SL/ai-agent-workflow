import { describe, expect, it } from "vitest";
import {
  createDefaultWorkflow,
  createKnowledgeDemoWorkflow,
  createNode,
  createReadableNodeId,
  EXAMPLE_KNOWLEDGE_BASE_ID,
  isWorkflowNodeOutputPath,
  parseWorkflowJson,
  resolveLLMModelSettings,
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
    expect(createNode("knowledge", { x: 0, y: 0 }, workflow.graph.nodes)).toMatchObject({
      id: "knowledge1",
      config: {
        knowledgeBaseIds: [],
        queryTemplate: "{{start1.topic}}",
        retrieval: { mode: "semantic", topK: 5 },
      },
    });
  });

  it("accepts strong Knowledge node config and exposes output fields", () => {
    const workflow = createDefaultWorkflow();
    const knowledge = createNode("knowledge", { x: 10, y: 20 }, workflow.graph.nodes);
    workflow.graph.nodes.push(knowledge);

    const result = validateWorkflowFile(workflow);

    expect(result.ok).toBe(true);
    if (knowledge.type === "knowledge") {
      expect(knowledge.config.retrieval.mode).toBe("semantic");
      expect(isWorkflowNodeOutputPath("knowledge", ["context"])).toBe(true);
      expect(isWorkflowNodeOutputPath("knowledge", ["result"])).toBe(true);
      expect(isWorkflowNodeOutputPath("knowledge", ["missing"])).toBe(false);
    }
  });

  it("builds a runnable Start → Knowledge → LLM customer-support demo", () => {
    const workflow = createKnowledgeDemoWorkflow();
    const result = validateWorkflowFile(workflow);

    expect(result.ok).toBe(true);
    expect(workflow.graph.nodes.map((node) => node.type)).toEqual(["start", "knowledge", "llm"]);
    expect(workflow.graph.edges).toEqual([
      { id: "edge-start-knowledge", source: "start1", target: "knowledge1" },
      { id: "edge-knowledge-llm", source: "knowledge1", target: "llm1" },
    ]);

    const start = workflow.graph.nodes.find((node) => node.type === "start");
    expect(start?.type === "start" && start.config.fields.map((field) => field.name)).toEqual(["customerQuestion"]);

    const knowledge = workflow.graph.nodes.find((node) => node.type === "knowledge");
    if (knowledge?.type === "knowledge") {
      expect(knowledge.config.knowledgeBaseIds).toEqual([EXAMPLE_KNOWLEDGE_BASE_ID]);
      expect(knowledge.config.queryTemplate).toBe("{{start1.customerQuestion}}");
    }

    const llm = workflow.graph.nodes.find((node) => node.type === "llm");
    const llmPrompt = llm?.type === "llm" ? llm.config.messages.map((message) => message.content).join("\n") : "";
    expect(llmPrompt).toContain("{{knowledge1.context}}");
    expect(llmPrompt).toContain("{{start1.customerQuestion}}");
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

  it("lets workflow model defaults carry advanced sampling settings", () => {
    const workflow = createDefaultWorkflow();
    workflow.settings.modelProvider = {
      provider: "openai",
      baseURL: "https://api.openai.com/v1",
      model: "gpt-5.2",
      temperature: 0.2,
      maxTokens: 1600,
    };
    const llm = workflow.graph.nodes.find((node) => node.type === "llm");

    expect(llm?.type).toBe("llm");
    if (llm?.type === "llm") {
      expect(resolveLLMModelSettings(workflow, llm)).toMatchObject({
        provider: "openai",
        model: "gpt-5.2",
        temperature: 0.2,
        maxTokens: 1600,
      });
    }
  });
});
