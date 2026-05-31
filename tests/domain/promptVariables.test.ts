import { describe, expect, it } from "vitest";
import { parsePromptVariables, resolvePromptVariables } from "../../src/domain/workflow/promptVariables";

describe("prompt variable utilities", () => {
  it("detects unique prompt variables", () => {
    expect(parsePromptVariables("Hello {{ name }}. Topic: {{topic}}. Again {{name}}")).toEqual(["name", "topic"]);
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
});
