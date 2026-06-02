import { describe, expect, it } from "vitest";
import {
  parsePromptVariableReferences,
  parsePromptVariables,
  resolvePromptWithRuntimeState,
  resolvePromptVariables,
} from "@ai-agent-workflow/workflow-domain";

describe("prompt variable utilities", () => {
  it("detects unique prompt variables", () => {
    expect(parsePromptVariables("Hello {{ start1.name }}. Topic: {{llm1.text}}. Again {{start1.name}}")).toEqual([
      "llm1.text",
      "start1.name",
    ]);
  });

  it("resolves provided prompt variables", () => {
    expect(resolvePromptVariables("Hello {{name}}", { name: "Ada" })).toEqual({
      ok: true,
      text: "Hello Ada",
      variables: ["name"],
    });
  });

  it("reports missing prompt variables", () => {
    const result = resolvePromptVariables("Hello {{name}} from {{city}}", { name: "Ada" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missingVariables).toEqual(["city"]);
    }
  });

  it("resolves namespaced runtime state variables", () => {
    expect(
      resolvePromptWithRuntimeState("Topic: {{start1.topic}} Usage: {{llm1.usage}} Optional: {{start1.audience}}", {
        start1: { topic: "LangGraph", audience: null },
        llm1: { usage: { total_tokens: 42 } },
      }),
    ).toEqual({
      ok: true,
      text: 'Topic: LangGraph Usage: {"total_tokens":42} Optional: ',
      variables: ["llm1.usage", "start1.audience", "start1.topic"],
    });
  });

  it("marks ambiguous prompt variables as unsupported references", () => {
    expect(parsePromptVariableReferences("Hello {{topic}}")).toEqual([
      {
        ok: false,
        value: "topic",
        error: "Use namespaced variables like {{start1.topic}}.",
      },
    ]);
  });
});
