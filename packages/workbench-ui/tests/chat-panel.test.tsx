import { fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "@ai-agent-workflow/i18n";
import { createDefaultWorkflow } from "@ai-agent-workflow/workflow-domain";
import { describe, expect, it, vi } from "vitest";
import { ChatPanel } from "../src/workbench/components/ChatPanel";
import { workbenchI18nResources } from "../src/i18n";

describe("ChatPanel", () => {
  it("does not submit with Enter while an IME composition is active", () => {
    const onSendMessage = vi.fn();

    render(
      <I18nProvider resources={workbenchI18nResources}>
        <ChatPanel
          workflow={{ ...createDefaultWorkflow(), metadata: { ...createDefaultWorkflow().metadata, mode: "chat" } }}
          transcript={[]}
          debugState={{ status: "idle" }}
          nodeStates={new Map()}
          conversationTurns={0}
          onSendMessage={onSendMessage}
        />
      </I18nProvider>,
    );

    // The `{{userInput.query}}` reference now lives inside the composer hint
    // tooltip, so it only appears once the info trigger is hovered/focused.
    fireEvent.focusIn(screen.getByLabelText("Input and memory hints"));
    expect(screen.getByTitle("User Input / query")).toBeInTheDocument();

    const composer = screen.getByPlaceholderText("输入消息，Enter 发送，Shift+Enter 换行");
    fireEvent.change(composer, { target: { value: "拼音中" } });
    fireEvent.keyDown(composer, { key: "Enter", code: "Enter", isComposing: true });
    expect(onSendMessage).not.toHaveBeenCalled();

    fireEvent.keyDown(composer, { key: "Enter", code: "Enter", isComposing: false });
    expect(onSendMessage).toHaveBeenCalledWith("拼音中", {});
  });
});
