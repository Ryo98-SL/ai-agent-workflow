import { createDefaultWorkflow } from "@ai-agent-workflow/workflow-domain";
import { describe, expect, it } from "vitest";
import { workflowDirtySnapshot } from "../src/workbench/workflowDirtySnapshot";

describe("workflow dirty snapshot", () => {
  it("ignores metadata timestamps and transient workflow-level API keys", () => {
    const workflow = createDefaultWorkflow();
    const changedTransientFields = {
      ...workflow,
      metadata: {
        ...workflow.metadata,
        updatedAt: "2030-01-01T00:00:00.000Z",
      },
      settings: {
        ...workflow.settings,
        modelProvider: workflow.settings.modelProvider
          ? {
              ...workflow.settings.modelProvider,
              apiKey: "transient-secret",
            }
          : undefined,
      },
    };

    expect(workflowDirtySnapshot(changedTransientFields)).toBe(workflowDirtySnapshot(workflow));
  });

  it("changes when persisted workflow content changes", () => {
    const workflow = createDefaultWorkflow();
    const movedWorkflow = {
      ...workflow,
      graph: {
        ...workflow.graph,
        nodes: workflow.graph.nodes.map((node) =>
          node.id === "llm1" ? { ...node, position: { x: node.position.x + 40, y: node.position.y } } : node,
        ),
      },
    };

    expect(workflowDirtySnapshot(movedWorkflow)).not.toBe(workflowDirtySnapshot(workflow));
  });
});
