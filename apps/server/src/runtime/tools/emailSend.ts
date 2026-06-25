import { RuntimeApiError } from "../errors";
import type { ToolRuntime } from "./types";

/**
 * Built-in: compose an email and (optionally) send it. Dry-run is the default —
 * it composes and outputs only, nothing is sent and no cost is incurred. Real
 * sending requires the authenticated, quota-protected `emailDelivery` capability.
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
      throw new RuntimeApiError("email_invalid", "Email tool resolved an empty recipient.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      throw new RuntimeApiError("email_invalid", "Email tool resolved an invalid recipient address.");
    }
    if (subject.length > 200) {
      throw new RuntimeApiError("email_invalid", "Email subject must be 200 characters or fewer.");
    }
    if (body.length > 50_000) {
      throw new RuntimeApiError("email_invalid", "Email body must be 50,000 characters or fewer.");
    }

    // Dry-run (default): compose and output only — nothing is sent, no cost.
    if (!send) {
      const email = { to, subject, body, sent: false, dryRun: true as const };
      return { output: `Email composed (dry-run) → ${to}`, data: email, logMetadata: { dryRun: true, to } };
    }

    if (!context.emailIdentity?.userId) {
      throw new RuntimeApiError("email_auth_required", "Sign in to send email for real. Dry-run remains available.");
    }
    if (!context.emailDelivery) {
      throw new RuntimeApiError(
        "email_not_configured",
        "Email sending is not configured on the server. Disable “Send for real” to compose a dry-run instead.",
      );
    }
    const result = await context.emailDelivery({ to, subject, body }, context.emailIdentity);
    const email = { to, subject, body, sent: true as const, dryRun: false as const, id: result.id };
    return {
      output: result.duplicate ? `Email already sent → ${to}` : `Email sent → ${to}`,
      data: email,
      logMetadata: { dryRun: false, duplicate: Boolean(result.duplicate), to },
    };
  },
};
