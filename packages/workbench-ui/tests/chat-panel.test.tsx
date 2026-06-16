import { fireEvent, render, screen } from "@testing-library/react";
import { createDefaultWorkflow } from "@ai-agent-workflow/workflow-domain";
import { describe, expect, it, vi } from "vitest";
import { ChatPanel } from "../src/workbench/components/ChatPanel";

describe("ChatPanel", () => {
  it("does not submit with Enter while an IME composition is active", () => {
    const onSendMessage = vi.fn();

    render(
      <ChatPanel
        workflow={{ ...createDefaultWorkflow(), metadata: { ...createDefaultWorkflow().metadata, mode: "chat" } }}
        transcript={[]}
        debugState={{ status: "idle" }}
        nodeStates={new Map()}
        conversationTurns={0}
        onSendMessage={onSendMessage}
      />,
    );

    const composer = screen.getByPlaceholderText("输入消息，Enter 发送，Shift+Enter 换行");
    fireEvent.change(composer, { target: { value: "拼音中" } });
    fireEvent.keyDown(composer, { key: "Enter", code: "Enter", isComposing: true });
    expect(onSendMessage).not.toHaveBeenCalled();

    fireEvent.keyDown(composer, { key: "Enter", code: "Enter", isComposing: false });
    expect(onSendMessage).toHaveBeenCalledWith("拼音中", {});
  });
});
