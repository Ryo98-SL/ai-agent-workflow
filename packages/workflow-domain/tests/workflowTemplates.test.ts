import { describe, expect, it } from "vitest";
import {
  buildWorkflowFromTemplate,
  getWorkflowTemplates,
  IFELSE_ELSE_HANDLE_ID,
  WORKFLOW_TEMPLATES,
  getWorkflowTemplate,
  validateWorkflowFile,
} from "@ai-agent-workflow/workflow-domain";
import type { SupportedLocale } from "@ai-agent-workflow/i18n/locale-contract";

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
    for (const locale of ["en-US", "zh-CN"] satisfies SupportedLocale[]) {
      for (const template of getWorkflowTemplates(locale)) {
        const result = validateWorkflowFile(template.build());
        expect(result.ok, `${template.id} should validate in ${locale}`).toBe(true);
      }
    }
  });

  it("looks templates up by id and locale", () => {
    expect(getWorkflowTemplate("support-hitl", "en-US")?.name).toBe("Support bot with human review");
    expect(getWorkflowTemplate("support-hitl", "zh-CN")?.name).toBe("客服机器人（含人工复核）");
    expect(getWorkflowTemplate("support-agent", "zh-CN")?.name).toBe("客服 Agent（工具 + MCP）");
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
    const workflow = buildWorkflowFromTemplate("support-hitl", "zh-CN");
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
    const workflow = buildWorkflowFromTemplate("agent-tools-demo", "en-US");
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
    const workflow = buildWorkflowFromTemplate("support-agent", "en-US");
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

  it("localizes generated workflow defaults without storing a locale binding", () => {
    const english = buildWorkflowFromTemplate("support-hitl", "en-US");
    const chinese = buildWorkflowFromTemplate("support-hitl", "zh-CN");
    const englishStart = english.graph.nodes.find((node) => node.id === "start1");
    const chineseStart = chinese.graph.nodes.find((node) => node.id === "start1");
    const englishHuman = english.graph.nodes.find((node) => node.id === "humanInput1");
    const chineseHuman = chinese.graph.nodes.find((node) => node.id === "humanInput1");

    expect(english.metadata.name).toBe("Support bot with human review");
    expect(chinese.metadata.name).toBe("客服机器人（含人工复核）");
    expect(englishStart?.type === "start" && englishStart.config.fields[0].label).toBe("Customer question");
    expect(chineseStart?.type === "start" && chineseStart.config.fields[0].label).toBe("客户问题");
    expect(englishHuman?.type === "humanInput" && englishHuman.config.actions[0].label).toBe("Approve");
    expect(chineseHuman?.type === "humanInput" && chineseHuman.config.actions[0].label).toBe("通过");
    expect("locale" in english.metadata).toBe(false);
  });
});
