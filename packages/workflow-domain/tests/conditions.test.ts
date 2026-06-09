import { describe, expect, it } from "vitest";
import {
  IFELSE_ELSE_HANDLE_ID,
  createNode,
  evaluateIfElseNode,
  type IfElseCase,
  type IfElseNode,
  type WorkflowRuntimeState,
} from "@ai-agent-workflow/workflow-domain";

function ifElseWith(cases: IfElseCase[]): IfElseNode {
  const node = createNode("ifElse", { x: 0, y: 0 }) as IfElseNode;
  return { ...node, config: { ...node.config, cases } };
}

describe("evaluateIfElseNode", () => {
  const state: WorkflowRuntimeState = {
    llm1: { text: "needs review", score: 8 },
    start1: { topic: "" },
  };

  it("returns the first matching case id", () => {
    const node = ifElseWith([
      { id: "case-1", combinator: "and", conditions: [{ variable: "{{llm1.text}}", operator: "contains", value: "review" }] },
    ]);
    expect(evaluateIfElseNode(node, state)).toBe("case-1");
  });

  it("falls through to else when nothing matches", () => {
    const node = ifElseWith([
      { id: "case-1", combinator: "and", conditions: [{ variable: "{{llm1.text}}", operator: "equals", value: "ok" }] },
    ]);
    expect(evaluateIfElseNode(node, state)).toBe(IFELSE_ELSE_HANDLE_ID);
  });

  it("respects case order (first win)", () => {
    const node = ifElseWith([
      { id: "case-1", combinator: "and", conditions: [{ variable: "{{llm1.text}}", operator: "isNotEmpty", value: "" }] },
      { id: "case-2", combinator: "and", conditions: [{ variable: "{{llm1.text}}", operator: "contains", value: "review" }] },
    ]);
    expect(evaluateIfElseNode(node, state)).toBe("case-1");
  });

  it("applies the and combinator", () => {
    const node = ifElseWith([
      {
        id: "case-1",
        combinator: "and",
        conditions: [
          { variable: "{{llm1.text}}", operator: "contains", value: "review" },
          { variable: "{{llm1.text}}", operator: "contains", value: "missing" },
        ],
      },
    ]);
    expect(evaluateIfElseNode(node, state)).toBe(IFELSE_ELSE_HANDLE_ID);
  });

  it("applies the or combinator", () => {
    const node = ifElseWith([
      {
        id: "case-1",
        combinator: "or",
        conditions: [
          { variable: "{{llm1.text}}", operator: "contains", value: "missing" },
          { variable: "{{llm1.text}}", operator: "contains", value: "review" },
        ],
      },
    ]);
    expect(evaluateIfElseNode(node, state)).toBe("case-1");
  });

  it("compares numbers for gt/lt operators", () => {
    const node = ifElseWith([
      { id: "case-1", combinator: "and", conditions: [{ variable: "{{llm1.score}}", operator: "gt", value: "5" }] },
    ]);
    expect(evaluateIfElseNode(node, state)).toBe("case-1");
  });

  it("treats a missing variable as empty (isEmpty matches)", () => {
    const node = ifElseWith([
      { id: "case-1", combinator: "and", conditions: [{ variable: "{{nope.gone}}", operator: "isEmpty", value: "" }] },
    ]);
    expect(evaluateIfElseNode(node, state)).toBe("case-1");
  });

  it("never matches a case with no conditions", () => {
    const node = ifElseWith([{ id: "case-1", combinator: "and", conditions: [] }]);
    expect(evaluateIfElseNode(node, state)).toBe(IFELSE_ELSE_HANDLE_ID);
  });
});
