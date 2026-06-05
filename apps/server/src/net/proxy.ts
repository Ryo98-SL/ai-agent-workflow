import { EnvHttpProxyAgent, setGlobalDispatcher } from "undici";
import { logger } from "../logger";

// Hosts that must NEVER go through the proxy — local model servers (Ollama),
// the database, etc. Otherwise the proxy tries to forward localhost and the
// request fails ("fetch failed"). Extend via the NO_PROXY env var.
const DEFAULT_NO_PROXY = "localhost,127.0.0.1,::1,0.0.0.0";

/**
 * Routes outbound `fetch` (Node's global undici dispatcher) through an HTTP
 * proxy — needed when server-side calls to external services (e.g. Better Auth
 * exchanging an OAuth code at oauth2.googleapis.com) are blocked or slow.
 *
 * Uses undici's EnvHttpProxyAgent so NO_PROXY is honored: local hosts like the
 * Ollama server bypass the proxy. Node's global fetch does NOT read HTTPS_PROXY
 * on its own, so we set the dispatcher explicitly.
 */
export function configureOutboundProxy(proxyUrl?: string): void {
  const url = proxyUrl?.trim();
  if (!url) {
    return;
  }

  const noProxy = process.env.NO_PROXY?.trim() || process.env.no_proxy?.trim() || DEFAULT_NO_PROXY;

  try {
    setGlobalDispatcher(new EnvHttpProxyAgent({ httpProxy: url, httpsProxy: url, noProxy }));
    logger.info("outbound_proxy.enabled", { proxyUrl: url, noProxy });
  } catch (error) {
    logger.warn("outbound_proxy.invalid", {
      proxyUrl: url,
      message: error instanceof Error ? error.message : "Invalid proxy URL.",
    });
  }
}

/**
 * Resolves the outbound proxy URL from env. Prefers an explicit
 * OUTBOUND_PROXY_URL, then falls back to the conventional proxy variables.
 */
export function resolveOutboundProxyUrl(): string | undefined {
  return (
    process.env.OUTBOUND_PROXY_URL ||
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.ALL_PROXY ||
    process.env.all_proxy ||
    undefined
  );
}
