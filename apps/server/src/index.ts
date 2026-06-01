import { serve } from "@hono/node-server";
import { createServerApp } from "./app";

export { createServerApp } from "./app";
export type { CreateServerAppOptions } from "./app";

const isDirectRun = process.argv[1]?.endsWith("/src/index.ts") ?? false;

if (isDirectRun) {
  const port = Number(process.env.PORT ?? "8788");
  const host = "127.0.0.1";

  serve({
    fetch: createServerApp().fetch,
    hostname: host,
    port,
  });

  console.log(`Workflow API server listening on http://${host}:${port}`);
}
