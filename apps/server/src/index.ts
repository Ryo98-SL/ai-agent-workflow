import { serve } from "@hono/node-server";
import { createServerApp } from "./app";
import { logger } from "./logger";

export { createServerApp } from "./app";
export type { CreateServerAppOptions } from "./app";
export { logger } from "./logger";
export type { Logger, LogLevel, LogMetadata } from "./logger";

const isDirectRun = process.argv[1]?.endsWith("/src/index.ts") ?? false;

if (isDirectRun) {
  const port = Number(process.env.PORT ?? "8788");
  const host = "127.0.0.1";

  serve({
    fetch: createServerApp().fetch,
    hostname: host,
    port,
  });

  logger.info("server.started", { host, port, url: `http://${host}:${port}` });
}
