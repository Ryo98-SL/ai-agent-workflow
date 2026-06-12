import { describe, expect, it } from "vitest";
import {
  formatVariableReference,
  getAvailableVariables,
  parseVariableReference,
  resolveAvailableVariable,
  type WorkflowEdge,
  type WorkflowNode,
} from "@ai-agent-workflow/workflow-domain";

const start: WorkflowNode = {
  id: "start1",
  type: "start",
  label: "Start",
  position: { x: 0, y: 0 },
  config: { fields: [{ name: "topic", label: "Topic", required: true }] },
};
const knowledge: WorkflowNode = {
  id: "knowledge1",
  type: "knowledge",
  label: "Knowledge",
  position: { x: 1, y: 0 },
  config: { knowledgeBaseIds: [], queryTemplate: "{{start1.topic}}", retrieval: { mode: "semantic", topK: 5 } },
};
const llm: WorkflowNode = {
  id: "llm1",
  type: "llm",
  label: "LLM",
  position: { x: 2, y: 0 },
  config: { messages: [{ role: "user", content: "x" }], variables: {}, temperature: 0.7, maxTokens: 800, memory: false },
};
const orphan: WorkflowNode = {
  id: "llm9",
  type: "llm",
  label: "Orphan",
  position: { x: 9, y: 9 },
  config: { messages: [{ role: "user", content: "x" }], variables: {}, temperature: 0.7, maxTokens: 800, memory: false },
};

const nodes: WorkflowNode[] = [llm, start, knowledge, orphan]; // intentionally unsorted
const edges: WorkflowEdge[] = [
  { id: "e1", source: "start1", target: "knowledge1" },
  { id: "e2", source: "knowledge1", target: "llm1" },
];

describe("parse/format variable reference", () => {
  it("round-trips wrapped and bare forms", () => {
    expect(parseVariableReference("{{ llm1.text }}")).toEqual({ ok: true, nodeId: "llm1", path: ["text"] });
    expect(parseVariableReference("knowledge1.result.content")).toEqual({
      ok: true,
      nodeId: "knowledge1",
      path: ["result", "content"],
    });
    expect(formatVariableReference("llm1", ["text"])).toBe("{{llm1.text}}");
  });

  it("rejects malformed references", () => {
    expect(parseVariableReference("").ok).toBe(false);
    expect(parseVariableReference("noPath").ok).toBe(false);
    expect(parseVariableReference("{{ 1bad.path }}").ok).toBe(false);
  });
});

describe("getAvailableVariables", () => {
  it("returns connected ancestors grouped in topological order", () => {
    const groups = getAvailableVariables(nodes, edges, "llm1");
    expect(groups.map((g) => g.nodeId)).toEqual(["start1", "knowledge1"]);
  });

  it("excludes disconnected nodes and self", () => {
    const groups = getAvailableVariables(nodes, edges, "llm1");
    expect(groups.some((g) => g.nodeId === "llm9")).toBe(false);
    expect(groups.some((g) => g.nodeId === "llm1")).toBe(false);
  });

  it("marks array-of-object outputs non-selectable but keeps scalar outputs", () => {
    const groups = getAvailableVariables(nodes, edges, "llm1");
    const knowledgeGroup = groups.find((g) => g.nodeId === "knowledge1")!;
    const result = knowledgeGroup.fields.find((f) => f.path.join(".") === "result")!;
    const context = knowledgeGroup.fields.find((f) => f.path.join(".") === "context")!;
    expect(result.selectable).toBe(false);
    expect(context.selectable).toBe(true);
    expect(context.reference).toBe("{{knowledge1.context}}");
  });

  it("returns no groups for a node with no upstream", () => {
    expect(getAvailableVariables(nodes, edges, "start1")).toEqual([]);
  });

  it("prepends the ambient userInput group in Chat Mode for every node", () => {
    // Even a node with no upstream (start1) sees the ambient namespace.
    const groups = getAvailableVariables(nodes, edges, "start1", { chatMode: true });
    expect(groups[0]?.nodeId).toBe("userInput");
    expect(groups[0]?.ambient).toBe(true);
    const query = groups[0].fields.find((f) => f.path.join(".") === "query")!;
    const files = groups[0].fields.find((f) => f.path.join(".") === "files")!;
    expect(query.reference).toBe("{{userInput.query}}");
    expect(query.selectable).toBe(true);
    expect(files.selectable).toBe(false); // Array[File] — reserved/deferred
  });

  it("omits the userInput group when not in Chat Mode", () => {
    const groups = getAvailableVariables(nodes, edges, "llm1");
    expect(groups.some((g) => g.nodeId === "userInput")).toBe(false);
  });

  it("resolves {{userInput.query}} only in Chat Mode", () => {
    expect(resolveAvailableVariable(nodes, edges, "llm1", "{{userInput.query}}", { chatMode: true })?.name).toBe("query");
    expect(resolveAvailableVariable(nodes, edges, "llm1", "{{userInput.query}}")).toBeUndefined();
  });
});

describe("resolveAvailableVariable", () => {
  it("resolves a reachable selectable field", () => {
    expect(resolveAvailableVariable(nodes, edges, "llm1", "{{start1.topic}}")?.name).toBe("topic");
  });

  it("returns undefined for unreachable or non-selectable references", () => {
    expect(resolveAvailableVariable(nodes, edges, "llm1", "{{llm9.text}}")).toBeUndefined();
    expect(resolveAvailableVariable(nodes, edges, "start1", "{{knowledge1.context}}")).toBeUndefined();
    expect(resolveAvailableVariable(nodes, edges, "llm1", "{{knowledge1.result}}")).toBeUndefined();
  });
});
