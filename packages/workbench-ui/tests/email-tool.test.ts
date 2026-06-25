import { describe, expect, it } from "vitest";
import { resolveToolDescriptor } from "@ai-agent-workflow/workflow-domain";
import { initialAgentToolParams } from "../src/workbench/components/tools/agentToolDefaults";

describe("Agent email tool defaults", () => {
  it("fixes real sending off so the model cannot enable it", () => {
    const descriptor = resolveToolDescriptor({
      provider: "builtin",
      providerId: "builtin",
      toolName: "emailSend",
    });
    expect(descriptor).toBeDefined();
    expect(initialAgentToolParams(descriptor!)).toEqual({ send: false });
  });
});
