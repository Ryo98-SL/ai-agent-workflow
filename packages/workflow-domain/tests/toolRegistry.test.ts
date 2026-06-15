import { afterEach, describe, expect, it } from "vitest";
import {
  BUILTIN_TOOL_DESCRIPTORS,
  createDefaultWorkflow,
  createNode,
  getToolDescriptors,
  jsonSchemaToParamSpec,
  nodeOutputFields,
  paramSpecToJsonSchema,
  registerMcpToolDescriptors,
  resolveToolDescriptor,
  TOOL_DESCRIPTORS,
  toolDescriptorKey,
  validateWorkflowFile,
  type ToolDescriptor,
  type ToolParamSpec,
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

describe("paramSpecToJsonSchema", () => {
  it("maps each param type, enum, required, and description", () => {
    const params: ToolParamSpec[] = [
      { name: "to", label: "To", type: "string", required: true, help: "Recipient" },
      { name: "body", label: "Body", type: "text" },
      { name: "count", label: "Count", type: "number" },
      { name: "send", label: "Send", type: "boolean" },
      {
        name: "tone",
        label: "Tone",
        type: "select",
        options: [
          { value: "formal", label: "Formal" },
          { value: "casual", label: "Casual" },
        ],
      },
    ];
    const schema = paramSpecToJsonSchema(params);
    expect(schema.type).toBe("object");
    expect(schema.required).toEqual(["to"]);
    expect(schema.properties).toEqual({
      to: { type: "string", description: "Recipient" },
      body: { type: "string", description: "Body" },
      count: { type: "number", description: "Count" },
      send: { type: "boolean", description: "Send" },
      tone: { type: "string", enum: ["formal", "casual"], description: "Tone" },
    });
  });

  it("returns empty object schema for no params", () => {
    expect(paramSpecToJsonSchema([])).toEqual({ type: "object", properties: {}, required: [] });
  });
});

describe("jsonSchemaToParamSpec", () => {
  it("round-trips a representative MCP-style input schema", () => {
    const schema = {
      type: "object",
      properties: {
        city: { type: "string", title: "City", description: "City name" },
        days: { type: "integer", description: "Forecast horizon" },
        units: { type: "string", enum: ["metric", "imperial"] },
        verbose: { type: "boolean" },
        filters: { type: "array", items: { type: "string" } },
      },
      required: ["city"],
    };
    const specs = jsonSchemaToParamSpec(schema, { primaryFirst: true });
    expect(specs).toEqual([
      { name: "city", label: "City", type: "string", required: true, help: "City name", primary: true },
      { name: "days", label: "days", type: "number", required: false, help: "Forecast horizon" },
      {
        name: "units",
        label: "units",
        type: "select",
        required: false,
        options: [
          { value: "metric", label: "metric" },
          { value: "imperial", label: "imperial" },
        ],
      },
      { name: "verbose", label: "verbose", type: "boolean", required: false },
      { name: "filters", label: "filters", type: "text", required: false },
    ]);
  });

  it("returns [] for malformed input", () => {
    expect(jsonSchemaToParamSpec(null)).toEqual([]);
    expect(jsonSchemaToParamSpec("nope")).toEqual([]);
    expect(jsonSchemaToParamSpec({})).toEqual([]);
    expect(jsonSchemaToParamSpec({ type: "object" })).toEqual([]);
  });
});

describe("client-only MCP descriptor merge", () => {
  afterEach(() => {
    // The injected set is a module-level global — reset so tests don't bleed.
    registerMcpToolDescriptors([]);
  });

  const mcpDescriptor: ToolDescriptor = {
    provider: "mcp",
    providerId: "weather",
    toolName: "forecast",
    label: "Forecast",
    icon: "plug",
    category: "mcp",
    description: "Weather forecast",
    params: [{ name: "city", label: "City", type: "string", required: true }],
    defaultParams: {},
    outputFields: [
      { name: "text", type: "string", description: "Forecast text" },
      { name: "data", type: "object", description: "Forecast data" },
    ],
  };

  it("resolves an injected MCP descriptor and its output fields without touching built-ins", () => {
    expect(resolveToolDescriptor({ provider: "mcp", providerId: "weather", toolName: "forecast" })).toBeUndefined();

    registerMcpToolDescriptors([mcpDescriptor]);

    expect(getToolDescriptors()).toEqual([...BUILTIN_TOOL_DESCRIPTORS, mcpDescriptor]);
    const resolved = resolveToolDescriptor({ provider: "mcp", providerId: "weather", toolName: "forecast" });
    expect(resolved?.label).toBe("Forecast");

    const mcpToolNode: WorkflowNode = {
      id: "tool1",
      type: "tool",
      label: "Forecast",
      position: { x: 0, y: 0 },
      config: { provider: "mcp", providerId: "weather", toolName: "forecast", params: {} },
    };
    expect(nodeOutputFields(mcpToolNode).map((f) => f.name)).toEqual(["text", "data"]);

    // Built-in resolution is unaffected by injection.
    expect(resolveToolDescriptor({ provider: "builtin", providerId: "builtin", toolName: "currentTime" })?.label).toBe(
      "Current Time",
    );
  });

  it("replaces (not appends) the injected set on each call", () => {
    registerMcpToolDescriptors([mcpDescriptor]);
    registerMcpToolDescriptors([]);
    expect(getToolDescriptors()).toEqual([...BUILTIN_TOOL_DESCRIPTORS]);
  });
});
