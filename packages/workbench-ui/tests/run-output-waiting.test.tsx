import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RunInterrupt } from "@ai-agent-workflow/api-contracts";
import { createSupportBotWithReviewWorkflow } from "@ai-agent-workflow/workflow-domain";
import { RunOutput } from "../src/workbench/components/RunOutput";
import type { DebugState, NodeExecutionState } from "../src/workbench/types";

// RunNodeCard transitively imports JsonViewer -> Monaco, which does not run in
// jsdom. The waiting card never renders it, but stub it for import safety.
vi.mock("@monaco-editor/react", () => ({
  default: (props: { value?: string }) => React.createElement("pre", null, props.value ?? ""),
}));

const interrupt: RunInterrupt = {
  nodeId: "humanInput1",
  prompt: "请复核草拟回复",
  actions: [
    { id: "approve", label: "通过", value: "approved" },
    { id: "reject", label: "驳回", value: "rejected" },
  ],
  allowTextInput: false,
};

const waitingState = (): DebugState => ({ status: "waiting", waiting: { runId: "run-1", interrupt } });

describe("RunOutput waiting node card", () => {
  it("renders the HITL form under the paused node's card and resumes on selection", () => {
    const workflow = createSupportBotWithReviewWorkflow();
    const onResumeRun = vi.fn();

    render(
      <RunOutput
        workflow={workflow}
        debugState={waitingState()}
        nodeStates={new Map<string, NodeExecutionState>()}
        onResumeRun={onResumeRun}
      />,
    );

    // The synthesized card carries the paused node's identity + waiting status…
    expect(screen.getByText("人工复核")).toBeInTheDocument();
    expect(screen.getByText("等待复核")).toBeInTheDocument();
    // …and hosts the reviewer prompt + its preset actions in its body.
    expect(screen.getByText("请复核草拟回复")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /通过/ }));
    expect(onResumeRun).toHaveBeenCalledWith("run-1", { action_id: "approve", action_value: "approved" });
  });

  it("omits the waiting card without an onResumeRun handler (opt-in, so ChatPanel's trace is not duplicated)", () => {
    const workflow = createSupportBotWithReviewWorkflow();

    render(
      <RunOutput
        workflow={workflow}
        debugState={waitingState()}
        nodeStates={new Map<string, NodeExecutionState>()}
      />,
    );

    expect(screen.queryByText("等待复核")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /通过/ })).not.toBeInTheDocument();
  });
});
