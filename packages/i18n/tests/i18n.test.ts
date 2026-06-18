import { describe, expect, it } from "vitest";
import {
  assertResourceKeyParity,
  createTranslator,
  normalizeLocale,
  PRODUCT_LOCALE_STORAGE_KEY,
  resolveInitialLocale,
  type I18nResourceBundle,
} from "../src";

const resources: I18nResourceBundle[] = [
  {
    namespace: "example",
    resources: {
      "en-US": {
        common: {
          title: "Workflow",
          count: "{{count}} nodes",
        },
      },
      "zh-CN": {
        common: {
          title: "工作流",
          count: "{{count}} 个节点",
        },
      },
    },
  },
];

describe("locale normalization", () => {
  it("normalizes supported locales and language-only inputs", () => {
    expect(normalizeLocale("en-US")).toBe("en-US");
    expect(normalizeLocale("zh-Hans-CN")).toBe("zh-CN");
    expect(normalizeLocale("zh")).toBe("zh-CN");
    expect(normalizeLocale("fr-FR")).toBeNull();
  });

  it("resolves manual locale before browser language and fallback", () => {
    expect(resolveInitialLocale({ storedLocale: "zh-CN", navigatorLanguages: ["en-US"] })).toBe("zh-CN");
    expect(resolveInitialLocale({ storedLocale: null, navigatorLanguages: ["zh-Hans"] })).toBe("zh-CN");
    expect(resolveInitialLocale({ storedLocale: null, navigatorLanguages: ["fr-FR"] })).toBe("en-US");
  });

  it("exports the stable product locale storage key", () => {
    expect(PRODUCT_LOCALE_STORAGE_KEY).toBe("ai-agent-workflow.productLocale");
  });
});

describe("translation resources", () => {
  it("creates a non-React translator", () => {
    const translator = createTranslator({ locale: "zh-CN", namespace: "example", resources });
    expect(translator.t("common.title")).toBe("工作流");
    expect(translator.t("common.count", { count: 3 })).toBe("3 个节点");
  });

  it("accepts resource bundles with matching keys", () => {
    expect(() => assertResourceKeyParity(resources)).not.toThrow();
  });

  it("fails when locale resources omit a key", () => {
    expect(() =>
      assertResourceKeyParity([
        {
          namespace: "broken",
          resources: {
            "en-US": { title: "Title", nested: { action: "Create" } },
            "zh-CN": { title: "标题" },
          },
        },
      ]),
    ).toThrow(/zh-CN missing: nested.action/);
  });
});
