import { serve } from "@hono/node-server";
import { createServerApp } from "./app";
import { logger } from "./logger";
import { configureOutboundProxy, resolveOutboundProxyUrl } from "./net/proxy";
import { createAuthedCheckpointer } from "./runs/checkpointer";

export { createServerApp } from "./app";
export type { CreateServerAppOptions } from "./app";
export { logger } from "./logger";
export type { Logger, LogLevel, LogMetadata } from "./logger";

const isDirectRun = process.argv[1]?.endsWith("/src/index.ts") ?? false;

if (isDirectRun) {
  const port = Number(process.env.PORT ?? "8788");
  const host = "127.0.0.1";

  // Must run before any outbound fetch (e.g. Better Auth OAuth token exchange).
  configureOutboundProxy(resolveOutboundProxyUrl());

  void (async () => {
    // Initialize the durable checkpointer (creates checkpoint tables on first run).
    const authedCheckpointer = (await createAuthedCheckpointer()) ?? undefined;

    serve({
      fetch: createServerApp({ authedCheckpointer }).fetch,
      hostname: host,
      port,
    });

    logger.info("server.started", {
      host,
      port,
      url: `http://${host}:${port}`,
      durableCheckpointer: Boolean(authedCheckpointer),
    });
  })();
}
