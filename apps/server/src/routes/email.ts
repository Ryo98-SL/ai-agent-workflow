import { apiPaths } from "@ai-agent-workflow/api-contracts";
import { Hono, type Context } from "hono";
import type { EmailDeliveryService } from "../email/types";

export function createEmailRoutes(options: {
  service: EmailDeliveryService;
  resolveUserId: (context: Context) => Promise<string | null>;
}) {
  const app = new Hono();
  app.get(apiPaths.emailCapability(), async (c) => {
    const userId = await options.resolveUserId(c);
    return c.json(await options.service.capability(userId));
  });
  return app;
}
