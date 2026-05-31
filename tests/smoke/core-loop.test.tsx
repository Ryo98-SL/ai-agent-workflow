import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppWorkbench } from "../../src/workbench/AppWorkbench";

describe("MVP smoke loop", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates, edits, runs, saves, reopens, and runs a tool path", async () => {
    const user = userEvent.setup();
    let savedContent = "";
    Object.defineProperty(window, "agentWorkflow", {
      configurable: true,
      value: {
        openWorkflow: vi.fn(async () => ({ ok: true, filePath: "/tmp/demo.agentflow.json", content: savedContent })),
        saveWorkflow: vi.fn(async (_filePath: string, content: string) => {
          savedContent = content;
          return { ok: true, filePath: "/tmp/demo.agentflow.json" };
        }),
        saveWorkflowAs: vi.fn(async (content: string) => {
          savedContent = content;
          return { ok: true, filePath: "/tmp/demo.agentflow.json" };
        }),
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: "Smoke response" } }] }), { status: 200 })),
    );

    render(<AppWorkbench />);
    await user.type(screen.getByPlaceholderText("gpt-4.1-mini"), "-smoke");
    await user.click(screen.getByRole("button", { name: "Run" }));
    expect(await screen.findByText("Smoke response")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save workflow as" }));
    expect(savedContent).toContain('"version": "1"');
    expect(savedContent).not.toContain("apiKey");

    await user.click(screen.getByRole("button", { name: "Open workflow" }));
    await user.click(screen.getByRole("button", { name: /Current Time/ }));
    await user.click(screen.getByRole("button", { name: "Run" }));

    expect((await screen.findAllByText(/UTC|Coordinated Universal Time/)).length).toBeGreaterThan(0);
  });
});
