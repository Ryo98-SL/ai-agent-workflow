import { fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "@ai-agent-workflow/i18n";
import { createDefaultWorkflow, type WorkflowFile } from "@ai-agent-workflow/workflow-domain";
import { describe, expect, it, vi } from "vitest";
import { ChatPanel } from "../src/workbench/components/ChatPanel";
import { workbenchI18nResources } from "../src/i18n";

function renderChat(workflow: WorkflowFile) {
  return render(
    <I18nProvider resources={workbenchI18nResources}>
      <ChatPanel
        workflow={workflow}
        startNode={undefined}
        transcript={[]}
        debugState={{ status: "idle" }}
        nodeStates={new Map()}
        conversationTurns={0}
        onSendMessage={vi.fn()}
      />
    </I18nProvider>,
  );
}

/** Toggles the default workflow's LLM node memory flag for the on/off cases. */
function workflowWithMemory(enabled: boolean): WorkflowFile {
  const workflow = createDefaultWorkflow();
  const llm = workflow.graph.nodes.find((node) => node.type === "llm");
  if (llm?.type === "llm") {
    llm.config = { ...llm.config, memory: enabled };
  }
  return workflow;
}

describe("ChatPanel composer hint tooltip", () => {
  it("hides both hints behind a single info trigger until hover/focus", () => {
    renderChat(workflowWithMemory(false));
    // The hint text is not rendered until the tooltip opens.
    expect(screen.queryByText(/userInput\.query/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Input and memory hints")).toBeInTheDocument();
  });

  it("guides the user to enable memory when no node has it on", async () => {
    renderChat(workflowWithMemory(false));
    fireEvent.focusIn(screen.getByLabelText("Input and memory hints"));
    expect(await screen.findByText(/Cross-turn memory is off/)).toBeInTheDocument();
    expect(screen.getByText(/reference it in the prompt/)).toBeInTheDocument();
  });

  it("reports cross-turn memory as on when an LLM/Agent node enables it", async () => {
    renderChat(workflowWithMemory(true));
    fireEvent.focusIn(screen.getByLabelText("Input and memory hints"));
    expect(await screen.findByText(/Cross-turn memory is on/)).toBeInTheDocument();
  });
});
