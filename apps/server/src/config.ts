/**
 * Allowed frontend origins for CORS + Better Auth trusted origins.
 *
 * `FRONTEND_ORIGIN` may be a comma-separated list. For each entry we also add
 * the localhost⇄127.0.0.1 counterpart, since the browser's origin string
 * depends on which host the user typed even though both resolve to the same
 * address in dev — a common source of CORS failures.
 */
function expandHostAliases(origin: string): string[] {
  const result = new Set<string>([origin]);
  try {
    const url = new URL(origin);
    if (url.hostname === "localhost") {
      url.hostname = "127.0.0.1";
      result.add(url.origin);
    } else if (url.hostname === "127.0.0.1") {
      url.hostname = "localhost";
      result.add(url.origin);
    }
  } catch {
    // Ignore malformed entries.
  }
  return [...result];
}

export const frontendOrigins: string[] = (process.env.FRONTEND_ORIGIN ?? "http://127.0.0.1:5173")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean)
  .flatMap(expandHostAliases);

// ---------------------------------------------------------------------------
// Platform-funded provider credentials backing "AI credits" runs.
//
// These are deployment secrets (one key per provider for the whole instance),
// not user data, so they live in env alongside DATABASE_URL / auth secrets and
// are read through `getCreditsProvider`. The base URL is forced to the official
// provider endpoint so a user-supplied baseURL can never exfiltrate the key.
// ---------------------------------------------------------------------------

type CreditsProvider = { apiKey: string; baseURL: string };
export type PlatformEmbeddingConfig = {
  provider: string;
  model: string;
  baseURL: string;
  apiKey: string;
};

const CREDITS_DEFAULT_BASE_URLS: Record<string, string> = {
  deepseek: "https://api.deepseek.com",
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
};

/**
 * The platform credit credential for a provider, or null when AI credits are
 * not configured for it. `CREDITS_<PROVIDER>_API_KEY` is required; the base URL
 * defaults to the official endpoint but may be overridden with
 * `CREDITS_<PROVIDER>_BASE_URL`.
 */
export function getCreditsProvider(provider: string): CreditsProvider | null {
  const key = provider.toUpperCase();
  const apiKey = process.env[`CREDITS_${key}_API_KEY`]?.trim();
  if (!apiKey) {
    return null;
  }
  const baseURL = process.env[`CREDITS_${key}_BASE_URL`]?.trim() || CREDITS_DEFAULT_BASE_URLS[provider];
  if (!baseURL) {
    return null;
  }
  return { apiKey, baseURL };
}

/**
 * Default platform-wide ceiling on AI-credits output tokens per UTC day, summed
 * across all users. Overridable with the `DAILY_OUTPUT_TOKEN_LIMIT` env var.
 */
export const DEFAULT_DAILY_OUTPUT_TOKEN_LIMIT = 1_000_000;

/**
 * The configured daily output-token ceiling for AI-credits runs. Falls back to
 * the default when `DAILY_OUTPUT_TOKEN_LIMIT` is unset, non-numeric, or not a
 * positive integer.
 */
export function getDailyOutputTokenLimit(): number {
  const raw = process.env.DAILY_OUTPUT_TOKEN_LIMIT?.trim();
  if (!raw) {
    return DEFAULT_DAILY_OUTPUT_TOKEN_LIMIT;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_DAILY_OUTPUT_TOKEN_LIMIT;
  }
  return parsed;
}

/**
 * Providers the platform can fund with AI credits: those that have a
 * `CREDITS_<PROVIDER>_API_KEY` configured. The candidate set is the providers we
 * know an official endpoint for; the UI uses this to only offer "AI Credits" for
 * providers the server can actually back.
 */
export function listConfiguredCreditProviders(): string[] {
  return Object.keys(CREDITS_DEFAULT_BASE_URLS).filter((provider) => getCreditsProvider(provider) != null);
}

export function getPlatformEmbeddingConfig(): PlatformEmbeddingConfig | null {
  const apiKey = process.env.EMBEDDING_API_KEY?.trim() || process.env.CREDITS_OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  return {
    provider: process.env.EMBEDDING_PROVIDER?.trim() || "openai",
    model: process.env.EMBEDDING_MODEL?.trim() || "text-embedding-3-small",
    baseURL: process.env.EMBEDDING_BASE_URL?.trim() || "https://api.openai.com/v1",
    apiKey,
  };
}
