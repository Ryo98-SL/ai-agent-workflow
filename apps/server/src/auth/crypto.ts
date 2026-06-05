import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * App-level envelope-free AES-256-GCM encryption for provider API keys.
 *
 * The master key comes from `MASTER_ENCRYPTION_KEY` (base64-encoded 32 bytes).
 * Plaintext keys are never persisted or returned to the client — only the
 * ciphertext, iv, authTag, and the last 4 chars (for masked display) are stored.
 *
 * Key rotation is intentionally out of scope for v1 (single master key).
 */

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12; // 96-bit nonce is the GCM recommendation.

export type EncryptedSecret = {
  ciphertext: Uint8Array<ArrayBuffer>;
  iv: Uint8Array<ArrayBuffer>;
  authTag: Uint8Array<ArrayBuffer>;
  last4: string;
};

// Buffer now types as Buffer<ArrayBufferLike>; Prisma Bytes wants
// Uint8Array<ArrayBuffer>. Copy into a freshly allocated ArrayBuffer-backed view.
function toBytes(buf: Buffer): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(buf.byteLength);
  out.set(buf);
  return out;
}

let cachedKey: Buffer | null = null;

function getMasterKey(): Buffer {
  if (cachedKey) {
    return cachedKey;
  }

  const raw = process.env.MASTER_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "MASTER_ENCRYPTION_KEY is not set. Generate one with: openssl rand -base64 32",
    );
  }

  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `MASTER_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes (got ${key.length}). Generate one with: openssl rand -base64 32`,
    );
  }

  cachedKey = key;
  return key;
}

/** Reset the cached master key. Test-only. */
export function resetMasterKeyCache(): void {
  cachedKey = null;
}

export function encryptSecret(plaintext: string): EncryptedSecret {
  if (plaintext.length === 0) {
    throw new Error("Cannot encrypt an empty secret.");
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, getMasterKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: toBytes(ciphertext),
    iv: toBytes(iv),
    authTag: toBytes(authTag),
    last4: plaintext.slice(-4),
  };
}

export function decryptSecret(secret: {
  ciphertext: Uint8Array;
  iv: Uint8Array;
  authTag: Uint8Array;
}): string {
  const decipher = createDecipheriv(ALGORITHM, getMasterKey(), secret.iv);
  decipher.setAuthTag(secret.authTag);
  const plaintext = Buffer.concat([decipher.update(secret.ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

/** Masked representation safe to return to the client. */
export function maskSecret(last4: string): string {
  return `••••${last4}`;
}
