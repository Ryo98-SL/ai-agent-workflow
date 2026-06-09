import { afterEach, describe, expect, it } from "vitest";
import { getCreditsProvider } from "../src/config";

const ENV_KEYS = [
  "CREDITS_DEEPSEEK_API_KEY",
  "CREDITS_DEEPSEEK_BASE_URL",
  "CREDITS_OPENAI_API_KEY",
] as const;

afterEach(() => {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
});

describe("getCreditsProvider", () => {
  it("returns null when no platform key is configured for the provider", () => {
    expect(getCreditsProvider("deepseek")).toBeNull();
  });

  it("returns the key with the official base URL by default", () => {
    process.env.CREDITS_DEEPSEEK_API_KEY = "sk-platform";
    expect(getCreditsProvider("deepseek")).toEqual({
      apiKey: "sk-platform",
      baseURL: "https://api.deepseek.com",
    });
  });

  it("allows overriding the base URL via env", () => {
    process.env.CREDITS_OPENAI_API_KEY = "sk-openai";
    expect(getCreditsProvider("openai")).toMatchObject({ baseURL: "https://api.openai.com/v1" });
  });

  it("ignores blank keys", () => {
    process.env.CREDITS_DEEPSEEK_API_KEY = "   ";
    expect(getCreditsProvider("deepseek")).toBeNull();
  });
});
