import { describe, expect, it } from "vitest";
import {
  IFELSE_ELSE_HANDLE_ID,
  WORKFLOW_TEMPLATES,
  getWorkflowTemplate,
  validateWorkflowFile,
} from "@ai-agent-workflow/workflow-domain";

describe("workflow templates registry", () => {
  it("exposes the blank, RAG, human-review, and Agent starters", () => {
    expect(WORKFLOW_TEMPLATES.map((template) => template.id)).toEqual([
      "blank",
      "support-rag",
      "support-hitl",
      "agent-tools-demo",
      "support-agent",
    ]);
  });

  it("every template builds a valid workflow", () => {
    for (const template of WORKFLOW_TEMPLATES) {
      const result = validateWorkflowFile(template.build());
      expect(result.ok, `${template.id} should validate`).toBe(true);
    }
  });

  it("looks templates up by id", () => {
    expect(getWorkflowTemplate("support-hitl")?.name).toBe("客服机器人（含人工复核）");
    expect(getWorkflowTemplate("support-agent")?.name).toBe("客服 Agent（工具 + MCP）");
    expect(getWorkflowTemplate("missing")).toBeUndefined();
  });

  it("declares runnability requirements for the credit-backed examples", () => {
    expect(getWorkflowTemplate("blank")?.requires).toEqual([]);
    expect(getWorkflowTemplate("support-rag")?.requires).toContain("credits");
    expect(getWorkflowTemplate("support-hitl")?.requires).toContain("credits");
    expect(getWorkflowTemplate("agent-tools-demo")?.requires).toContain("credits");
    expect(getWorkflowTemplate("support-agent")?.requires).toContain("credits");
  });

  it("wires the human-review flagship with knowledge, branch, and HITL", () => {
    const workflow = getWorkflowTemplate("support-hitl")!.build();
    const types = new Set(workflow.graph.nodes.map((node) => node.type));
    expect(types).toContain("knowledge");
    expect(types).toContain("llm");
    expect(types).toContain("ifElse");
    expect(types).toContain("humanInput");

    const ifElse = workflow.graph.nodes.find((node) => node.type === "ifElse");
    expect(ifElse?.type === "ifElse" && ifElse.config.cases[0].id).toBe("needsReview");

    // The branch edges leave through the matching source handles.
    const branchHandles = workflow.graph.edges
      .filter((edge) => edge.source === "ifElse1")
      .map((edge) => edge.sourceHandle)
      .sort();
    expect(branchHandles).toEqual([IFELSE_ELSE_HANDLE_ID, "needsReview"].sort());

    // The LLM keeps conversation memory on for multi-turn support.
    const llm = workflow.graph.nodes.find((node) => node.type === "llm");
    expect(llm?.type === "llm" && llm.config.memory).toBe(true);
  });

  it("wires the Agent tool-routing starter with built-in and MCP tools", () => {
    const workflow = getWorkflowTemplate("agent-tools-demo")!.build();
    const agent = workflow.graph.nodes.find((node) => node.type === "agent");

    expect(agent?.type).toBe("agent");
    if (agent?.type !== "agent") {
      throw new Error("agent node missing");
    }
    expect(agent.config.tools).toEqual([
      {
        provider: "builtin",
        providerId: "builtin",
        toolName: "currentTime",
        params: { timezone: "Asia/Shanghai" },
      },
      { provider: "mcp", providerId: "builtin", toolName: "get_demo_fact", params: {} },
    ]);

    expect(workflow.graph.edges.map((edge) => `${edge.source}->${edge.target}`)).toEqual([
      "start1->agent1",
      "agent1->end1",
    ]);
  });

  it("wires the support Agent starter with Knowledge plus built-in and MCP tools", () => {
    const workflow = getWorkflowTemplate("support-agent")!.build();
    const types = new Set(workflow.graph.nodes.map((node) => node.type));
    expect(types).toContain("knowledge");
    expect(types).toContain("agent");
    expect(types).toContain("end");

    const agent = workflow.graph.nodes.find((node) => node.type === "agent");
    expect(agent?.type === "agent" && agent.config.memory).toBe(true);
    expect(agent?.type === "agent" && agent.config.query).toContain("{{knowledge1.context}}");
    expect(agent?.type === "agent" && agent.config.tools).toEqual([
      {
        provider: "builtin",
        providerId: "builtin",
        toolName: "currentTime",
        params: { timezone: "Asia/Shanghai" },
      },
      { provider: "mcp", providerId: "builtin", toolName: "get_demo_fact", params: {} },
    ]);

    expect(workflow.graph.edges.map((edge) => `${edge.source}->${edge.target}`)).toEqual([
      "start1->knowledge1",
      "knowledge1->agent1",
      "agent1->end1",
    ]);
  });
});
