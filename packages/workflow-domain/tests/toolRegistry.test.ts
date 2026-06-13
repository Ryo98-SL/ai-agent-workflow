import { describe, expect, it } from "vitest";
import {
  BUILTIN_TOOL_DESCRIPTORS,
  createDefaultWorkflow,
  createNode,
  nodeOutputFields,
  resolveToolDescriptor,
  TOOL_DESCRIPTORS,
  toolDescriptorKey,
  validateWorkflowFile,
  type WorkflowNode,
} from "@ai-agent-workflow/workflow-domain";

/** Builds a workflow whose extra `tool1` node carries the given raw config. */
function workflowWithToolConfig(config: unknown): unknown {
  const plain = JSON.parse(JSON.stringify(createDefaultWorkflow())) as {
    graph: { nodes: Array<Record<string, unknown>> };
  };
  plain.graph.nodes.push({ id: "tool1", type: "tool", label: "Tool", position: { x: 0, y: 0 }, config });
  return plain;
}

function parsedToolConfig(config: unknown): Record<string, unknown> | undefined {
  const result = validateWorkflowFile(workflowWithToolConfig(config));
  if (!result.ok) {
    throw new Error(result.error);
  }
  const tool = result.data.graph.nodes.find((node) => node.id === "tool1");
  return tool?.type === "tool" ? (tool.config as unknown as Record<string, unknown>) : undefined;
}

describe("tool node schema", () => {
  it("creates a tool node bound to the Current Time builtin", () => {
    const tool = createNode("tool", { x: 0, y: 0 });
    expect(tool.label).toBe("Current Time");
    expect(tool.type === "tool" && tool.config).toEqual({
      provider: "builtin",
      providerId: "builtin",
      toolName: "currentTime",
      params: { timezone: "UTC" },
    });
  });

  it("accepts a generic tool config", () => {
    expect(
      parsedToolConfig({ provider: "builtin", providerId: "builtin", toolName: "emailSend", params: { to: "a@b.c" } }),
    ).toEqual({ provider: "builtin", providerId: "builtin", toolName: "emailSend", params: { to: "a@b.c" } });
  });

  it("rejects a tool config missing identity fields", () => {
    expect(validateWorkflowFile(workflowWithToolConfig({ provider: "builtin", providerId: "builtin" })).ok).toBe(false);
    expect(validateWorkflowFile(workflowWithToolConfig({ provider: "builtin", toolName: "x", params: {} })).ok).toBe(
      false,
    );
  });
});

describe("legacy tool config migration", () => {
  it("migrates a currentTime adapter into the generic shape", () => {
    expect(parsedToolConfig({ adapter: "currentTime", timezone: "Asia/Shanghai" })).toEqual({
      provider: "builtin",
      providerId: "builtin",
      toolName: "currentTime",
      params: { timezone: "Asia/Shanghai" },
    });
  });

  it("migrates an emailSend adapter, moving typed fields into params", () => {
    expect(parsedToolConfig({ adapter: "emailSend", to: "a@b.c", subject: "s", body: "b", send: true })).toEqual({
      provider: "builtin",
      providerId: "builtin",
      toolName: "emailSend",
      params: { to: "a@b.c", subject: "s", body: "b", send: true },
    });
  });

  it("falls back to Current Time for an unknown legacy adapter", () => {
    expect(parsedToolConfig({ adapter: "mystery" })).toEqual({
      provider: "builtin",
      providerId: "builtin",
      toolName: "currentTime",
      params: { timezone: "UTC" },
    });
  });

  it("passes an already-migrated config through untouched", () => {
    const config = { provider: "mcp", providerId: "server-1", toolName: "search", params: { q: "{{start1.topic}}" } };
    expect(parsedToolConfig(config)).toEqual(config);
  });
});

describe("tool descriptor registry", () => {
  it("registers exactly the builtin tools", () => {
    expect(BUILTIN_TOOL_DESCRIPTORS.map((d) => d.toolName)).toEqual(["currentTime", "emailSend"]);
    expect(TOOL_DESCRIPTORS).toEqual(BUILTIN_TOOL_DESCRIPTORS);
  });

  it("resolves a bound descriptor and returns undefined for an unknown tool", () => {
    const email = resolveToolDescriptor({ provider: "builtin", providerId: "builtin", toolName: "emailSend" });
    expect(email?.label).toBe("Send Email");
    expect(email?.params.find((p) => p.name === "to")).toMatchObject({ supportsVariables: true, primary: true });
    const send = email?.params.find((p) => p.name === "send");
    expect(send?.type).toBe("boolean");
    expect(send?.help).toBeTruthy();
    expect(resolveToolDescriptor({ provider: "mcp", providerId: "x", toolName: "nope" })).toBeUndefined();
  });

  it("keys identity as provider:providerId:toolName", () => {
    expect(toolDescriptorKey("builtin", "builtin", "currentTime")).toBe("builtin:builtin:currentTime");
  });

  it("resolves per-tool output fields, falling back to generic for an unknown tool", () => {
    const emailNode: WorkflowNode = {
      id: "tool1",
      type: "tool",
      label: "Send Email",
      position: { x: 0, y: 0 },
      config: { provider: "builtin", providerId: "builtin", toolName: "emailSend", params: {} },
    };
    const data = nodeOutputFields(emailNode).find((f) => f.name === "data");
    expect(data?.children?.map((c) => c.name)).toEqual(["to", "subject", "body", "sent", "dryRun"]);

    const unknownNode: WorkflowNode = { ...emailNode, config: { ...emailNode.config, toolName: "nope" } };
    expect(nodeOutputFields(unknownNode).map((f) => f.name)).toEqual(["text", "data"]);
  });
});
