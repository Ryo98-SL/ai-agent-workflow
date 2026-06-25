import { describe, expect, it, vi } from "vitest";
import { createWorkflowClient } from "../src/index";

describe("email capability client", () => {
  it("loads and validates the public capability snapshot", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          email: {
            configured: true,
            eligible: false,
            available: false,
            reason: "sign_in_required",
            limits: { userMinute: 10, userDay: 100, platformDay: 80, platformMonth: 2400 },
            remaining: { userMinute: null, userDay: null, platformDay: 80, platformMonth: 2400 },
            resets: {
              userMinute: null,
              day: "2026-06-25T00:00:00.000Z",
              month: "2026-07-01T00:00:00.000Z",
            },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const client = createWorkflowClient({ baseUrl: "http://api.test", fetch: fetchMock });

    await expect(client.getEmailCapability()).resolves.toMatchObject({
      email: { reason: "sign_in_required", limits: { platformDay: 80 } },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/api/email-capability",
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );
  });
});
