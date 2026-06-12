import { describe, expect, it } from "vitest";
import {
  IFELSE_ELSE_HANDLE_ID,
  WORKFLOW_TEMPLATES,
  getWorkflowTemplate,
  validateWorkflowFile,
} from "@ai-agent-workflow/workflow-domain";

describe("workflow templates registry", () => {
  it("exposes the blank, RAG, and human-review starters", () => {
    expect(WORKFLOW_TEMPLATES.map((template) => template.id)).toEqual(["blank", "support-rag", "support-hitl"]);
  });

  it("every template builds a valid workflow", () => {
    for (const template of WORKFLOW_TEMPLATES) {
      const result = validateWorkflowFile(template.build());
      expect(result.ok, `${template.id} should validate`).toBe(true);
    }
  });

  it("looks templates up by id", () => {
    expect(getWorkflowTemplate("support-hitl")?.name).toBe("客服机器人（含人工复核）");
    expect(getWorkflowTemplate("missing")).toBeUndefined();
  });

  it("declares runnability requirements for the credit-backed examples", () => {
    expect(getWorkflowTemplate("blank")?.requires).toEqual([]);
    expect(getWorkflowTemplate("support-rag")?.requires).toContain("credits");
    expect(getWorkflowTemplate("support-hitl")?.requires).toContain("credits");
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
});
