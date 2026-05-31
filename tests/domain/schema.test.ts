import { describe, expect, it } from "vitest";
import { createDefaultWorkflow, parseWorkflowJson, serializeWorkflowFile, validateWorkflowFile } from "../../src/domain/workflow/schema";

describe("workflow schema", () => {
  it("accepts the default workflow and includes the MVP node family", () => {
    const workflow = createDefaultWorkflow();
    const result = validateWorkflowFile(workflow);

    expect(result.ok).toBe(true);
    expect(workflow.graph.nodes.map((node) => node.type)).toEqual(["start", "llm", "tool"]);
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

  it("omits API keys during serialization", () => {
    const workflow = createDefaultWorkflow();
    workflow.settings.modelProvider = {
      baseURL: "http://127.0.0.1:8787/v1",
      model: "mock-gpt",
      apiKey: "secret",
    };

    const serialized = serializeWorkflowFile(workflow);

    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("apiKey");
  });
});
