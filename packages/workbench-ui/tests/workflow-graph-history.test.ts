import { createDefaultWorkflow, createNode, type WorkflowEdge, type WorkflowFile } from "@ai-agent-workflow/workflow-domain";
import { describe, expect, it } from "vitest";
import { applyWorkflowGraphHistoryEntry } from "../src/workbench/hooks/useWorkflowGraphHistory";

describe("workflow graph history", () => {
  it("moves nodes without overwriting inspector-owned node data", () => {
    const workflow = withEditedLlmNode(createDefaultWorkflow());
    const llmNode = workflow.graph.nodes.find((node) => node.id === "llm1");
    expect(llmNode).toBeDefined();

    const moved = applyWorkflowGraphHistoryEntry(
      workflow,
      {
        type: "moveNodes",
        positions: [{ nodeId: "llm1", before: llmNode!.position, after: { x: llmNode!.position.x + 80, y: llmNode!.position.y + 40 } }],
      },
      "redo",
    );
    const movedNode = moved.graph.nodes.find((node) => node.id === "llm1");

    expect(movedNode?.position).toEqual({ x: llmNode!.position.x + 80, y: llmNode!.position.y + 40 });
    expect(movedNode).toMatchObject({ label: "Edited LLM", description: "Inspector-owned description" });
    expect(movedNode?.type).toBe("llm");
    if (movedNode?.type === "llm") {
      expect(movedNode.config.messages[0].content).toBe("Inspector-owned prompt");
      expect(movedNode.config.modelSettings?.model).toBe("gpt-5.2");
    }
  });

  it("restores deletion-time node snapshots when undoing node deletion", () => {
    const workflow = withEditedLlmNode(createDefaultWorkflow());
    const deletedNode = workflow.graph.nodes.find((node) => node.id === "llm1");
    const deletedEdges = workflow.graph.edges.filter((edge) => edge.source === "llm1" || edge.target === "llm1");
    expect(deletedNode).toBeDefined();
    expect(deletedEdges.length).toBeGreaterThan(0);

    const deletionEntry = { type: "removeNodes" as const, nodes: [deletedNode!], edges: deletedEdges };
    const removed = applyWorkflowGraphHistoryEntry(workflow, deletionEntry, "redo");
    const restored = applyWorkflowGraphHistoryEntry(removed, deletionEntry, "undo");
    const restoredNode = restored.graph.nodes.find((node) => node.id === "llm1");

    expect(removed.graph.nodes.some((node) => node.id === "llm1")).toBe(false);
    expect(removed.graph.edges.some((edge) => edge.source === "llm1" || edge.target === "llm1")).toBe(false);
    expect(restoredNode).toEqual(deletedNode);
    expect(restored.graph.edges).toEqual(expect.arrayContaining(deletedEdges));
  });

  it("undoes add-node entries by removing the captured node and captured edges", () => {
    const workflow = createDefaultWorkflow();
    const node = createNode("code", { x: 500, y: 120 }, workflow.graph.nodes);
    const edge: WorkflowEdge = { id: "edge-llm1-code1", source: "llm1", target: "code1" };
    const entry = { type: "addNode" as const, node, edges: [edge] };

    const added = applyWorkflowGraphHistoryEntry(workflow, entry, "redo");
    const undone = applyWorkflowGraphHistoryEntry(added, entry, "undo");

    expect(added.graph.nodes).toEqual(expect.arrayContaining([node]));
    expect(added.graph.edges).toEqual(expect.arrayContaining([edge]));
    expect(undone.graph.nodes.some((candidate) => candidate.id === "code1")).toBe(false);
    expect(undone.graph.edges.some((candidate) => candidate.id === edge.id)).toBe(false);
  });
});

function withEditedLlmNode(workflow: WorkflowFile): WorkflowFile {
  return {
    ...workflow,
    graph: {
      ...workflow.graph,
      nodes: workflow.graph.nodes.map((node) =>
        node.type === "llm"
          ? {
              ...node,
              label: "Edited LLM",
              description: "Inspector-owned description",
              config: {
                ...node.config,
                messages: [{ role: "user", content: "Inspector-owned prompt" }],
                modelSettings: {
                provider: "openai",
                  baseURL: "https://api.openai.com/v1",
                  model: "gpt-5.2",
                  apiKey: "node-key",
                  temperature: 0.4,
                  maxTokens: 1200,
                },
              },
            }
          : node,
      ),
    },
  };
}
