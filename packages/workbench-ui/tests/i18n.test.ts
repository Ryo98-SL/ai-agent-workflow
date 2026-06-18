import { describe, expect, it } from "vitest";
import { assertResourceKeyParity } from "@ai-agent-workflow/i18n";
import { workbenchI18nResources } from "../src/i18n";

describe("workbench i18n resources", () => {
  it("keeps en-US and zh-CN keys in parity", () => {
    expect(() => assertResourceKeyParity(workbenchI18nResources)).not.toThrow();
  });
});
