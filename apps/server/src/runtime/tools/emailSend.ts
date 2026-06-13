import { RuntimeValidationError } from "../errors";
import type { ToolRuntime } from "./types";

/**
 * Built-in: compose an email and (optionally) send it. Dry-run is the default —
 * it composes and outputs only, nothing is sent and no cost is incurred. Real
 * sending requires a server-configured `emailSender` (env-gated Resend).
 */
export const emailSendRuntime: ToolRuntime = {
  provider: "builtin",
  providerId: "builtin",
  toolName: "emailSend",
  async execute(params, context) {
    const to = (typeof params.to === "string" ? params.to : "").trim();
    const subject = typeof params.subject === "string" ? params.subject : "";
    const body = typeof params.body === "string" ? params.body : "";
    const send = params.send === true;

    if (!to) {
      throw new RuntimeValidationError("Email tool resolved an empty recipient.");
    }

    // Dry-run (default): compose and output only — nothing is sent, no cost.
    if (!send) {
      const email = { to, subject, body, sent: false, dryRun: true as const };
      return { output: `Email composed (dry-run) → ${to}`, data: email, logMetadata: { dryRun: true, to } };
    }

    // Real send: requires a server-configured sender (env-gated Resend).
    if (!context.emailSender) {
      throw new RuntimeValidationError(
        "Email sending is not configured on the server. Disable “Send for real” to compose a dry-run instead.",
      );
    }
    const result = await context.emailSender({ to, subject, body });
    const email = { to, subject, body, sent: true as const, dryRun: false as const, id: result.id };
    return { output: `Email sent → ${to}`, data: email, logMetadata: { dryRun: false, to } };
  },
};
