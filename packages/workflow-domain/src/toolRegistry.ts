import {
  workflowNodeOutputFields,
  type JsonValue,
  type ToolNodeConfig,
  type ToolProvider,
  type WorkflowNode,
  type WorkflowNodeOutputField,
} from "./schema";

/**
 * Tool Registry (see CONTEXT.md — Tool Node, Tool Registry, Tool Browser; ADR 0003).
 *
 * There is one `tool` node type; the specific tool a node runs is data in its
 * config. This module is the declarative half of the registry — pure metadata
 * importable by both the UI and the server: a tool's identity, its param-spec
 * (the inspector form), its default params (binding), and its output variables.
 * The runtime half (`execute`) lives server-side, keyed by the same identity.
 */

/** Control kinds the declarative inspector can render for a tool param. */
export type ToolParamType = "string" | "text" | "boolean" | "number" | "select";

/**
 * One configurable input of a tool, declared by its descriptor. The inspector
 * renders the matching control; the server resolves `supportsVariables` string
 * params through `{{nodeId.path}}` substitution before executing the tool.
 */
export type ToolParamSpec = {
  name: string;
  label: string;
  type: ToolParamType;
  required?: boolean;
  default?: JsonValue;
  /** string/text only — render the variable-aware rich-text editor. */
  supportsVariables?: boolean;
  /** select only. */
  options?: { value: string; label: string }[];
  placeholder?: string;
  help?: string;
  /** Surfaced on the node card summary (the primary identifying inputs). */
  primary?: boolean;
};

/**
 * A catalog entry a Tool node binds to. Holds the tool's identity plus everything
 * the rest of the app dispatches on: param-spec (inspector), default params
 * (binding), and output variables. Built-in entries are static; MCP/custom/workflow
 * entries are reserved (eventually populated dynamically).
 */
export type ToolDescriptor = {
  provider: ToolProvider;
  providerId: string;
  toolName: string;
  label: string;
  /** lucide icon key resolved to a component by the UI (e.g. "clock", "mail"). */
  icon: string;
  category: ToolProvider;
  description?: string;
  params: ToolParamSpec[];
  defaultParams: Record<string, JsonValue>;
  outputFields: WorkflowNodeOutputField[];
};

const currentTimeDescriptor: ToolDescriptor = {
  provider: "builtin",
  providerId: "builtin",
  toolName: "currentTime",
  label: "Current Time",
  icon: "clock",
  category: "builtin",
  description: "Return the current date and time in a timezone.",
  params: [{ name: "timezone", label: "Timezone", type: "string", default: "UTC", placeholder: "UTC" }],
  defaultParams: { timezone: "UTC" },
  outputFields: [
    { name: "text", type: "string", description: "Formatted current time" },
    {
      name: "data",
      type: "object",
      description: "Structured time output",
      children: [
        { name: "timezone", type: "string", description: "Resolved timezone" },
        { name: "iso", type: "string", description: "ISO-8601 timestamp" },
        { name: "formatted", type: "string", description: "Human-readable time" },
      ],
    },
  ],
};

const emailSendDescriptor: ToolDescriptor = {
  provider: "builtin",
  providerId: "builtin",
  toolName: "emailSend",
  label: "Send Email",
  icon: "mail",
  category: "builtin",
  description: "Compose an email; sends for real only when enabled (otherwise dry-run).",
  params: [
    {
      name: "to",
      label: "To",
      type: "string",
      supportsVariables: true,
      required: true,
      primary: true,
      placeholder: "user@example.com  ·  输入 / 引用变量",
    },
    {
      name: "subject",
      label: "Subject",
      type: "string",
      supportsVariables: true,
      primary: true,
      placeholder: "工单已受理  ·  输入 / 引用变量",
    },
    { name: "body", label: "Body", type: "text", supportsVariables: true, placeholder: "邮件正文，输入 / 引用变量" },
    {
      name: "send",
      label: "Send for real",
      type: "boolean",
      default: false,
      help: "关 = dry-run（仅组装，不发送，无成本）；开需服务端已配置 provider。",
    },
  ],
  defaultParams: { to: "", subject: "", body: "", send: false },
  outputFields: [
    { name: "text", type: "string", description: "Send/compose summary" },
    {
      name: "data",
      type: "object",
      description: "Composed email + send result",
      children: [
        { name: "to", type: "string", description: "Recipient" },
        { name: "subject", type: "string", description: "Subject" },
        { name: "body", type: "string", description: "Body" },
        { name: "sent", type: "boolean", description: "Whether it was actually sent" },
        { name: "dryRun", type: "boolean", description: "True when composed only (not sent)" },
        { name: "id", type: "string", description: "Provider message id when a real send succeeds" },
      ],
    },
  ],
};

/** Built-in tools that ship in-repo. */
export const BUILTIN_TOOL_DESCRIPTORS: ToolDescriptor[] = [currentTimeDescriptor, emailSendDescriptor];

/** All registered tools. Only builtin entries exist today (MCP/custom/workflow reserved). */
export const TOOL_DESCRIPTORS: ToolDescriptor[] = [...BUILTIN_TOOL_DESCRIPTORS];

/**
 * MCP tool descriptors merged into the registry at run time.
 *
 * ⚠️ **CLIENT-ONLY** (ADR 0004 §6 — multi-tenant safety). This module-level set is
 * a process-global. In the browser that is exactly right: the web app fetches the
 * signed-in user's MCP server snapshots and calls {@link registerMcpToolDescriptors}
 * so {@link resolveToolDescriptor} stays **synchronous** and the Tool Browser /
 * inspectors render offline.
 *
 * The **server MUST NEVER** call {@link registerMcpToolDescriptors} — a server
 * process is shared across all tenants, so injecting one user's MCP tools into this
 * global would leak them into every other user's request. Server code resolves
 * per-user descriptors explicitly at the API boundary instead.
 */
let injectedMcpDescriptors: ToolDescriptor[] = [];

/**
 * Replaces the client-only injected MCP descriptor set (see {@link injectedMcpDescriptors}).
 * **Client-only** — never call this on the server (multi-tenant safety, ADR 0004 §6).
 */
export function registerMcpToolDescriptors(list: ToolDescriptor[]): void {
  injectedMcpDescriptors = [...list];
}

/**
 * All descriptors visible to synchronous lookups: built-ins plus any client-injected
 * MCP descriptors. On the server (which never injects) this is exactly the built-ins.
 */
export function getToolDescriptors(): ToolDescriptor[] {
  return [...BUILTIN_TOOL_DESCRIPTORS, ...injectedMcpDescriptors];
}

/** Stable lookup key for a tool's identity triple. */
export function toolDescriptorKey(provider: string, providerId: string, toolName: string): string {
  return `${provider}:${providerId}:${toolName}`;
}

/** Resolves the descriptor a Tool node's config is bound to, if any. */
export function resolveToolDescriptor(
  config: Pick<ToolNodeConfig, "provider" | "providerId" | "toolName">,
): ToolDescriptor | undefined {
  const key = toolDescriptorKey(config.provider, config.providerId, config.toolName);
  return getToolDescriptors().find(
    (descriptor) => toolDescriptorKey(descriptor.provider, descriptor.providerId, descriptor.toolName) === key,
  );
}

/**
 * Converts a tool's declarative param-spec into a JSON Schema object — the
 * model-facing argument schema for an agent's bound tool (ADR 0005). Author-fixed
 * params are stripped by the caller before binding; what remains is exposed to the
 * model. Pure and dependency-free (shared by server runtime and UI).
 */
export function paramSpecToJsonSchema(params: ToolParamSpec[]): {
  type: "object";
  properties: Record<string, unknown>;
  required: string[];
} {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const param of params) {
    let schema: Record<string, unknown>;
    switch (param.type) {
      case "number":
        schema = { type: "number" };
        break;
      case "boolean":
        schema = { type: "boolean" };
        break;
      case "select":
        schema = { type: "string" };
        if (param.options?.length) {
          schema.enum = param.options.map((option) => option.value);
        }
        break;
      // string + text both map to a JSON string.
      default:
        schema = { type: "string" };
        break;
    }
    const description = param.help ?? param.label;
    if (description) {
      schema.description = description;
    }
    properties[param.name] = schema;
    if (param.required) {
      required.push(param.name);
    }
  }
  return { type: "object", properties, required };
}

/**
 * Inverse of {@link paramSpecToJsonSchema}: converts an MCP tool's input JSON Schema
 * into declarative param-specs so its descriptor renders in the inspector/Tool
 * Browser (ADR 0004 snapshot). Property `type` maps `string`→`string`,
 * `number`/`integer`→`number`, `boolean`→`boolean`, an `enum`→`select`; anything
 * else (array/object/unknown) becomes a `text` placeholder. Defensive: a malformed
 * schema yields `[]`.
 *
 * @param opts.primaryFirst When true, marks the first produced param `primary` so it
 *   surfaces on the node card summary.
 */
export function jsonSchemaToParamSpec(schema: unknown, opts: { primaryFirst?: boolean } = {}): ToolParamSpec[] {
  if (!schema || typeof schema !== "object") {
    return [];
  }
  const root = schema as Record<string, unknown>;
  const properties = root.properties;
  if (!properties || typeof properties !== "object") {
    return [];
  }
  const required = new Set(
    Array.isArray(root.required) ? root.required.filter((name): name is string => typeof name === "string") : [],
  );

  const specs: ToolParamSpec[] = [];
  for (const [name, rawProp] of Object.entries(properties as Record<string, unknown>)) {
    const prop = rawProp && typeof rawProp === "object" ? (rawProp as Record<string, unknown>) : {};
    const jsonType = typeof prop.type === "string" ? prop.type : undefined;
    const enumValues = Array.isArray(prop.enum) && prop.enum.length > 0 ? prop.enum : undefined;

    let type: ToolParamType;
    let options: { value: string; label: string }[] | undefined;
    if (enumValues) {
      type = "select";
      options = enumValues.map((value) => ({ value: String(value), label: String(value) }));
    } else if (jsonType === "number" || jsonType === "integer") {
      type = "number";
    } else if (jsonType === "boolean") {
      type = "boolean";
    } else if (jsonType === "string") {
      type = "string";
    } else {
      // array / object / unknown — surface as a free-text placeholder.
      type = "text";
    }

    const spec: ToolParamSpec = {
      name,
      label: typeof prop.title === "string" ? prop.title : name,
      type,
      required: required.has(name),
    };
    if (typeof prop.description === "string") {
      spec.help = prop.description;
    }
    if (options) {
      spec.options = options;
    }
    specs.push(spec);
  }

  if (opts.primaryFirst && specs.length > 0) {
    specs[0].primary = true;
  }
  return specs;
}

/**
 * Output variables a node exposes. For Tool nodes this resolves the bound tool's
 * descriptor (precise per-tool fields), falling back to the generic tool fields
 * for an unknown/unbound tool. Other node types defer to the type-keyed table.
 */
export function nodeOutputFields(node: WorkflowNode): WorkflowNodeOutputField[] {
  if (node.type === "tool") {
    return resolveToolDescriptor(node.config)?.outputFields ?? workflowNodeOutputFields("tool");
  }
  return workflowNodeOutputFields(node.type);
}
