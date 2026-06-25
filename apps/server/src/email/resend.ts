import type { EmailSender } from "./types";

const RESEND_SEND_TIMEOUT_MS = 10_000;

export function createEnvEmailSender(fetchImpl?: typeof fetch): EmailSender | undefined {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    return undefined;
  }
  const doFetch = fetchImpl ?? fetch;
  return async (email) => {
    const response = await doFetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: email.to, subject: email.subject, text: email.body }),
      signal: AbortSignal.timeout(RESEND_SEND_TIMEOUT_MS),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Email send failed (${response.status}): ${detail.slice(0, 200)}`);
    }
    const payload = (await response.json().catch(() => ({}))) as { id?: string };
    return { id: payload.id };
  };
}
