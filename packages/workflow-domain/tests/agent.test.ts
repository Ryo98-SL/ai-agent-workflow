import { describe, expect, it } from "vitest";
import {
  AGENT_STRATEGIES,
  createDefaultWorkflow,
  createNode,
  getAvailableVariables,
  nodeTypeDescription,
  nodeTypeLabel,
  validateWorkflowFile,
  workflowNodeOutputFields,
} from "@ai-agent-workflow/workflow-domain";

/** Builds a workflow whose extra `agent1` node carries the given raw config. */
function workflowWithAgentConfig(config: unknown): unknown {
  const plain = JSON.parse(JSON.stringify(createDefaultWorkflow())) as {
    graph: { nodes: Array<Record<string, unknown>> };
  };
  plain.graph.nodes.push({ id: "agent1", type: "agent", label: "Agent", position: { x: 0, y: 0 }, config });
  return plain;
}

function parsedAgentConfig(config: unknown): Record<string, unknown> {
  const result = validateWorkflowFile(workflowWithAgentConfig(config));
  if (!result.ok) {
    throw new Error(result.error);
  }
  const agent = result.data.graph.nodes.find((node) => node.id === "agent1");
  if (agent?.type !== "agent") {
    throw new Error("agent node missing");
  }
  return agent.config as unknown as Record<string, unknown>;
}

describe("agent node schema", () => {
  it("applies documented defaults for an empty config", () => {
    expect(parsedAgentConfig({})).toMatchObject({
      strategy: "functionCalling",
      instruction: "",
      query: "{{userInput.query}}",
      tools: [],
      maxIterations: 5,
      memory: false,
      temperature: 0.7,
      maxTokens: 800,
    });
  });

  it("parses a full config including an inline tool binding", () => {
    const config = parsedAgentConfig({
      strategy: "react",
      instruction: "You are helpful.",
      query: "{{start1.topic}}",
      tools: [{ provider: "mcp", providerId: "weather", toolName: "forecast", params: { units: "metric" } }],
      maxIterations: 12,
      memory: true,
      temperature: 0.2,
      maxTokens: 1200,
    });
    expect(config.strategy).toBe("react");
    expect(config.tools).toEqual([
      { provider: "mcp", providerId: "weather", toolName: "forecast", params: { units: "metric" } },
    ]);
    expect(config.maxIterations).toBe(12);
    expect(config.memory).toBe(true);
  });

  it("defaults a tool binding's params to an empty object", () => {
    const config = parsedAgentConfig({
      tools: [{ provider: "builtin", providerId: "builtin", toolName: "currentTime" }],
    });
    expect((config.tools as Array<Record<string, unknown>>)[0]).toEqual({
      provider: "builtin",
      providerId: "builtin",
      toolName: "currentTime",
      params: {},
    });
  });

  it("rejects an empty query", () => {
    expect(validateWorkflowFile(workflowWithAgentConfig({ query: "" })).ok).toBe(false);
  });

  it("rejects maxIterations outside [1, 50]", () => {
    expect(validateWorkflowFile(workflowWithAgentConfig({ maxIterations: 0 })).ok).toBe(false);
    expect(validateWorkflowFile(workflowWithAgentConfig({ maxIterations: 51 })).ok).toBe(false);
    expect(parsedAgentConfig({ maxIterations: 50 }).maxIterations).toBe(50);
  });

  it("rejects an unknown strategy", () => {
    expect(validateWorkflowFile(workflowWithAgentConfig({ strategy: "chainOfThought" })).ok).toBe(false);
    expect(AGENT_STRATEGIES).toEqual(["functionCalling", "react"]);
  });

  it("round-trips through the discriminated union", () => {
    const workflow = createDefaultWorkflow();
    const agent = createNode("agent", { x: 200, y: 200 }, workflow.graph.nodes);
    workflow.graph.nodes.push(agent);
    const start = workflow.graph.nodes.find((node) => node.type === "start");
    workflow.graph.edges.push({ id: "edge-start-agent", source: start!.id, target: agent.id });
    expect(validateWorkflowFile(workflow).ok).toBe(true);
  });
});

describe("agent node creation + labels", () => {
  it("creates an agent node with the documented default and label", () => {
    const agent = createNode("agent", { x: 0, y: 0 });
    expect(agent.label).toBe("Agent");
    expect(agent.type).toBe("agent");
    if (agent.type === "agent") {
      expect(agent.config).toEqual({
        strategy: "functionCalling",
        instruction: "",
        query: "{{userInput.query}}",
        tools: [],
        maxIterations: 5,
        memory: false,
        temperature: 0.7,
        maxTokens: 800,
      });
    }
  });

  it("exposes agent in the label + description tables", () => {
    expect(nodeTypeLabel("agent")).toBe("Agent");
    expect(nodeTypeDescription("agent")).toBe("Let a model call tools in a loop to reach an answer.");
  });

  it("returns text + usage + data.steps output fields", () => {
    const fields = workflowNodeOutputFields("agent");
    expect(fields.map((field) => field.name)).toEqual(["text", "usage", "data"]);
    const data = fields.find((field) => field.name === "data");
    expect(data?.children?.map((child) => child.name)).toEqual(["steps"]);
  });
});

describe("agent output variables flow downstream", () => {
  it("exposes {{agentN.text}} (selectable) and the steps header (not selectable) to a connected consumer", () => {
    const workflow = createDefaultWorkflow();
    const agent = createNode("agent", { x: 200, y: 200 }, workflow.graph.nodes);
    const end = createNode("end", { x: 400, y: 200 }, [...workflow.graph.nodes, agent]);
    workflow.graph.nodes.push(agent, end);
    workflow.graph.edges.push({ id: "edge-agent-end", source: agent.id, target: end.id });

    const groups = getAvailableVariables(workflow.graph.nodes, workflow.graph.edges, end.id);
    const agentGroup = groups.find((group) => group.nodeId === agent.id);
    const text = agentGroup?.fields.find((field) => field.reference === `{{${agent.id}.text}}`);
    expect(text?.selectable).toBe(true);
    const steps = agentGroup?.fields.find((field) => field.reference === `{{${agent.id}.data.steps}}`);
    expect(steps?.selectable).toBe(false);
  });
});
