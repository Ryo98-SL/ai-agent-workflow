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
