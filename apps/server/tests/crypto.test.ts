import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, maskSecret, resetMasterKeyCache } from "../src/auth/crypto";

const ORIGINAL_KEY = process.env.MASTER_ENCRYPTION_KEY;

describe("provider key crypto", () => {
  beforeEach(() => {
    process.env.MASTER_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    resetMasterKeyCache();
  });

  afterEach(() => {
    process.env.MASTER_ENCRYPTION_KEY = ORIGINAL_KEY;
    resetMasterKeyCache();
  });

  it("round-trips a secret", () => {
    const plaintext = "sk-test-1234567890ABCD";
    const encrypted = encryptSecret(plaintext);

    expect(Buffer.from(encrypted.ciphertext).toString("utf8")).not.toContain(plaintext);
    expect(encrypted.last4).toBe("ABCD");
    expect(decryptSecret(encrypted)).toBe(plaintext);
  });

  it("produces a unique iv per call", () => {
    const a = encryptSecret("sk-aaaaaaaa");
    const b = encryptSecret("sk-aaaaaaaa");
    expect(Buffer.from(a.iv).equals(Buffer.from(b.iv))).toBe(false);
    expect(Buffer.from(a.ciphertext).equals(Buffer.from(b.ciphertext))).toBe(false);
  });

  it("rejects a tampered authTag", () => {
    const encrypted = encryptSecret("sk-tamper-test");
    const badTag = Uint8Array.from(encrypted.authTag);
    badTag[0] ^= 0xff;
    expect(() => decryptSecret({ ...encrypted, authTag: badTag })).toThrow();
  });

  it("rejects a missing master key", () => {
    delete process.env.MASTER_ENCRYPTION_KEY;
    resetMasterKeyCache();
    expect(() => encryptSecret("sk-x")).toThrow(/MASTER_ENCRYPTION_KEY/);
  });

  it("rejects a wrong-length master key", () => {
    process.env.MASTER_ENCRYPTION_KEY = Buffer.from("too-short").toString("base64");
    resetMasterKeyCache();
    expect(() => encryptSecret("sk-x")).toThrow(/32 bytes/);
  });

  it("masks for display", () => {
    expect(maskSecret("ABCD")).toBe("••••ABCD");
  });
});
