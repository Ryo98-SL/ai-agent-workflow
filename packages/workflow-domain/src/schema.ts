import { z } from "zod";

export const NODE_TYPES = [
  "start",
  "llm",
  "knowledge",
  "tool",
  "agent",
  "code",
  "ifElse",
  "humanInput",
  "template",
  "end",
] as const;

export type WorkflowNodeType = (typeof NODE_TYPES)[number];

const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const BaseNodeSchema = z.object({
  id: z.string().min(1),
  position: PositionSchema,
  label: z.string().min(1),
  description: z.string().optional(),
});

const StartFieldSchema = z.object({
  name: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Use letters, numbers, and underscores; do not start with a number."),
  label: z.string().optional(),
  required: z.boolean().default(false),
  defaultValue: z.string().optional(),
});

const StartNodeSchema = BaseNodeSchema.extend({
  type: z.literal("start"),
  config: z
    .object({
      fields: z.array(StartFieldSchema).default([]),
    })
    .default({ fields: [] })
    .superRefine((config, context) => {
      const names = new Set<string>();
      for (const [index, field] of config.fields.entries()) {
        if (names.has(field.name)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate Start field name "${field.name}".`,
            path: ["fields", index, "name"],
          });
        }
        names.add(field.name);
      }
    }),
});

/**
 * Tool providers (sources). `builtin` ships in-repo; `mcp` / `custom` / `workflow`
 * are reserved for dynamically-discovered or user-defined tools and are not
 * populated yet (see ADR 0003 / CONTEXT.md — Tool Node, Tool Registry).
 */
export const TOOL_PROVIDERS = ["builtin", "mcp", "custom", "workflow"] as const;
export const ToolProviderSchema = z.enum(TOOL_PROVIDERS);
export type ToolProvider = z.infer<typeof ToolProviderSchema>;

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(JsonValueSchema), z.record(JsonValueSchema)]),
);

/** Default config for a fresh/unbound Tool node — bound to the Current Time builtin. */
const DEFAULT_TOOL_CONFIG = {
  provider: "builtin",
  providerId: "builtin",
  toolName: "currentTime",
  params: { timezone: "UTC" },
} as const;

const defaultToolConfig = () => ({ ...DEFAULT_TOOL_CONFIG, params: { ...DEFAULT_TOOL_CONFIG.params } });

/**
 * Migrate legacy `{ adapter, … }` Tool configs (per-adapter typed fields) into the
 * generic `{ provider, providerId, toolName, params }` shape (ADR 0003), so tool
 * nodes saved before the registry refactor keep loading. Built-in adapters move
 * their typed fields into `params`; an unknown adapter falls back to Current Time.
 */
function migrateToolConfig(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") {
    return raw;
  }
  const record = raw as Record<string, unknown>;
  // Already the new shape, or nothing legacy to migrate.
  if ("provider" in record || !("adapter" in record)) {
    return raw;
  }
  if (record.adapter === "emailSend") {
    return {
      provider: "builtin",
      providerId: "builtin",
      toolName: "emailSend",
      params: {
        to: typeof record.to === "string" ? record.to : "",
        subject: typeof record.subject === "string" ? record.subject : "",
        body: typeof record.body === "string" ? record.body : "",
        send: typeof record.send === "boolean" ? record.send : false,
      },
    };
  }
  if (record.adapter === "currentTime") {
    return {
      provider: "builtin",
      providerId: "builtin",
      toolName: "currentTime",
      params: { timezone: typeof record.timezone === "string" ? record.timezone : "UTC" },
    };
  }
  // Unknown legacy adapter → a valid bound default (a Tool node is never unbound).
  return defaultToolConfig();
}

const ToolNodeSchema = BaseNodeSchema.extend({
  type: z.literal("tool"),
  config: z.preprocess(
    migrateToolConfig,
    z
      .object({
        provider: ToolProviderSchema,
        providerId: z.string().min(1),
        toolName: z.string().min(1),
        /** Configured tool inputs; variable-bearing strings stay `{{nodeId.path}}`. */
        params: z.record(JsonValueSchema).default({}),
      })
      .default(defaultToolConfig),
  ),
});

const KnowledgeRetrievalConfigSchema = z
  .object({
    mode: z.enum(["semantic", "keyword", "hybrid"]).default("semantic"),
    topK: z.number().int().min(1).max(20).default(5),
    scoreThreshold: z.number().min(0).max(1).optional(),
  })
  .default({ mode: "semantic", topK: 5 });

const KnowledgeNodeSchema = BaseNodeSchema.extend({
  type: z.literal("knowledge"),
  config: z.object({
    knowledgeBaseIds: z.array(z.string().min(1)).default([]),
    queryTemplate: z.string().min(1).default("{{start1.topic}}"),
    retrieval: KnowledgeRetrievalConfigSchema,
  }),
});

const BasicConfigNodeSchema = <Type extends Exclude<WorkflowNodeType, "start" | "llm" | "knowledge" | "tool" | "agent">>(
  type: Type,
) =>
  BaseNodeSchema.extend({
    type: z.literal(type),
    config: z
      .object({
        note: z.string().optional(),
      })
      .default({}),
  });

export const MODEL_PROVIDERS = ["deepseek", "openai", "anthropic", "ollama"] as const;
export const ModelProviderSchema = z.enum(MODEL_PROVIDERS);

export const OpenAICompatibleSettingsSchema = z.object({
  provider: ModelProviderSchema.default("deepseek"),
  baseURL: z.string().url().default("https://api.deepseek.com"),
  apiKey: z.string().optional(),
  model: z.string().min(1).default("deepseek-v4-flash"),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().max(32000).optional(),
});

export const ModelProviderKeysSchema = z
  .object({
    deepseek: z.string().optional(),
    openai: z.string().optional(),
    anthropic: z.string().optional(),
    ollama: z.string().optional(),
  })
  .default({});

/** Where a provider's runs draw their model access from. */
export const UsagePrioritySchema = z.enum(["credits", "apiKey"]);

/**
 * Per-provider selection persisted in workflow settings: which stored key is
 * active and whether the provider runs on shared AI credits or the user's key.
 */
export const ProviderKeyPreferenceSchema = z.object({
  providerKeyId: z.string().optional(),
  usagePriority: UsagePrioritySchema.default("credits"),
});

/** Keyed by provider name (e.g. "openai", "deepseek"). */
export const ProviderKeyPrefsSchema = z.record(z.string(), ProviderKeyPreferenceSchema).default({});

/**
 * Workflow capability: `"workflow"` is the default one-shot run; `"chat"` turns
 * the graph into a multi-turn chatbot (Chat Mode — see CONTEXT.md / ADR 0002),
 * enabling the `userInput` ambient namespace and conversation memory UX.
 */
export const WORKFLOW_MODES = ["workflow", "chat"] as const;
export const WorkflowModeSchema = z.enum(WORKFLOW_MODES);
export type WorkflowMode = z.infer<typeof WorkflowModeSchema>;

/**
 * Summary-buffer compression policy for the shared conversation memory channel.
 * Conversation-level (not per-node): the `messages` buffer is shared across the
 * thread, so a single policy governs it. When the buffer's estimated size exceeds
 * `triggerTokens`, turns older than the last `keepTurns` are folded into a running
 * summary. Disabled by default.
 */
export const MemorySummarySchema = z
  .object({
    enabled: z.boolean().default(false),
    /** Estimated-token budget (char/4 heuristic) that triggers compression. */
    triggerTokens: z.number().int().positive().default(2000),
    /** How many of the most recent turns stay verbatim after compression. */
    keepTurns: z.number().int().min(0).default(4),
  })
  .default({});
export type MemorySummarySettings = z.infer<typeof MemorySummarySchema>;

export const MemorySettingsSchema = z
  .object({
    summary: MemorySummarySchema,
  })
  .default({});
export type MemorySettings = z.infer<typeof MemorySettingsSchema>;

export const LLMModelSettingsSchema = OpenAICompatibleSettingsSchema;

/** Roles a prompt message can take, mirroring Dify's LLM node. */
export const PROMPT_MESSAGE_ROLES = ["system", "user", "assistant"] as const;
export const PromptMessageRoleSchema = z.enum(PROMPT_MESSAGE_ROLES);
export type PromptMessageRole = z.infer<typeof PromptMessageRoleSchema>;

export const PromptMessageSchema = z.object({
  role: PromptMessageRoleSchema,
  content: z.string().default(""),
});
export type PromptMessage = z.infer<typeof PromptMessageSchema>;

/** Default prompt for a fresh LLM node: one (empty) system message + one user message. */
export const DEFAULT_LLM_MESSAGES: PromptMessage[] = [
  { role: "system", content: "" },
  { role: "user", content: "Write a short response for {{topic}}." },
];

/**
 * Migrate legacy `{ systemPrompt, userPrompt }` LLM configs into the unified
 * `messages` array on parse, so workflows saved before the variable-length
 * prompt list keep loading. The first message stays `system` (even if empty),
 * matching Dify's "always one system prompt" invariant.
 */
function migrateLLMConfig(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") {
    return raw;
  }
  const record = raw as Record<string, unknown>;
  if (Array.isArray(record.messages)) {
    return raw;
  }
  if (!("systemPrompt" in record) && !("userPrompt" in record)) {
    return raw;
  }
  const { systemPrompt, userPrompt, ...rest } = record;
  const messages: PromptMessage[] = [
    { role: "system", content: typeof systemPrompt === "string" ? systemPrompt : "" },
    { role: "user", content: typeof userPrompt === "string" ? userPrompt : "" },
  ];
  return { ...rest, messages };
}

const LLMNodeSchema = BaseNodeSchema.extend({
  type: z.literal("llm"),
  config: z.preprocess(
    migrateLLMConfig,
    z.object({
      messages: z.array(PromptMessageSchema).min(1).default(DEFAULT_LLM_MESSAGES),
      variables: z.record(z.string()).default({ topic: "workflow debugging" }),
      model: z.string().optional(),
      modelSettings: LLMModelSettingsSchema.optional(),
      temperature: z.number().min(0).max(2).default(0.7),
      maxTokens: z.number().int().positive().max(32000).default(800),
      /**
       * When true, the node reads prior conversation turns from the run's memory
       * channel and appends this turn (user + assistant) — enabling multi-turn
       * chat when runs share a conversation thread.
       */
      memory: z.boolean().default(false),
    }),
  ),
});

/**
 * Agentic strategies an Agent node can run (see ADR 0005). `functionCalling`
 * drives the model's native tool-calling loop and is the implemented path;
 * `react` (text Thought/Action/Observation parsing) is reserved — selectable but
 * the runtime throws "not implemented yet".
 */
export const AGENT_STRATEGIES = ["functionCalling", "react"] as const;
export const AgentStrategySchema = z.enum(AGENT_STRATEGIES);
export type AgentStrategy = z.infer<typeof AgentStrategySchema>;

/**
 * One inline tool an Agent node may call — the same identity triple a Tool node
 * binds to (ADR 0003): `{ provider, providerId, toolName }` plus `params`. The
 * `params` hold **author-fixed** values; every input the author leaves unset is
 * exposed to the model as a callable argument (ADR 0005).
 */
export const AgentToolBindingSchema = z.object({
  provider: ToolProviderSchema,
  providerId: z.string().min(1),
  toolName: z.string().min(1),
  /** Author-fixed inputs; variable-bearing strings stay `{{nodeId.path}}`. */
  params: z.record(JsonValueSchema).default({}),
});
export type AgentToolBinding = z.infer<typeof AgentToolBindingSchema>;

/**
 * Agent node (ADR 0005): a model-driven, bounded tool-calling loop over an inline
 * Agent Tool List. `instruction` is the system message and `query` the user
 * message (both variable-bearing); `query` defaults to the Chat Mode ambient
 * `{{userInput.query}}`. `maxIterations` caps the LangGraph loop; `memory` reuses
 * the shared conversation channel; `model`/`modelSettings` reuse the LLM node's
 * resolution.
 */
const AgentNodeSchema = BaseNodeSchema.extend({
  type: z.literal("agent"),
  config: z
    .object({
      strategy: AgentStrategySchema.default("functionCalling"),
      instruction: z.string().default(""),
      query: z.string().min(1).default("{{userInput.query}}"),
      tools: z.array(AgentToolBindingSchema).default([]),
      maxIterations: z.number().int().min(1).max(50).default(5),
      memory: z.boolean().default(false),
      model: z.string().optional(),
      modelSettings: LLMModelSettingsSchema.optional(),
      temperature: z.number().min(0).max(2).default(0.7),
      maxTokens: z.number().int().positive().max(32000).default(800),
    })
    .default({}),
});

/** Operators with no right-hand `value` (they test the left operand alone). */
export const VALUELESS_CONDITION_OPERATORS = ["isEmpty", "isNotEmpty"] as const;
export const CONDITION_OPERATORS = [
  "equals",
  "notEquals",
  "contains",
  "notContains",
  "isEmpty",
  "isNotEmpty",
  "gt",
  "gte",
  "lt",
  "lte",
] as const;
export const ConditionOperatorSchema = z.enum(CONDITION_OPERATORS);

/** Reserved source-handle id for the implicit `else` (fallthrough) branch. */
export const IFELSE_ELSE_HANDLE_ID = "else";

const ConditionRowSchema = z.object({
  /** Left operand — a `{{nodeId.path}}` template resolved against runtime state. */
  variable: z.string().default(""),
  operator: ConditionOperatorSchema.default("equals"),
  /** Right operand — a literal (ignored for valueless operators). */
  value: z.string().default(""),
});

const IfElseCaseSchema = z.object({
  /** Stable id; doubles as the case's source-handle id. */
  id: z.string().min(1),
  /** How the rows combine. */
  combinator: z.enum(["and", "or"]).default("and"),
  conditions: z.array(ConditionRowSchema).default([]),
});

const IfElseNodeSchema = BaseNodeSchema.extend({
  type: z.literal("ifElse"),
  config: z
    .object({
      cases: z.array(IfElseCaseSchema).min(1).default([{ id: "case-1", combinator: "and", conditions: [] }]),
    })
    .default({ cases: [{ id: "case-1", combinator: "and", conditions: [] }] })
    .superRefine((config, context) => {
      const ids = new Set<string>();
      for (const [index, branch] of config.cases.entries()) {
        if (branch.id === IFELSE_ELSE_HANDLE_ID) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Case id "${IFELSE_ELSE_HANDLE_ID}" is reserved for the else branch.`,
            path: ["cases", index, "id"],
          });
        }
        if (ids.has(branch.id)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate case id "${branch.id}".`,
            path: ["cases", index, "id"],
          });
        }
        ids.add(branch.id);
      }
    }),
});

/**
 * Reserved action id emitted when the reviewer submits free-form text rather
 * than clicking a preset action. The node always outputs exactly
 * `{ action_id, action_value }`; for text submissions `action_value` is the text.
 */
export const HUMAN_INPUT_TEXT_ACTION_ID = "__input__";

const HumanInputActionSchema = z.object({
  /** Stable id surfaced as `action_id` when this button is chosen. */
  id: z.string().min(1),
  label: z.string().min(1),
  /** Surfaced as `action_value` when this button is chosen. */
  value: z.string().default(""),
});

const HumanInputNodeSchema = BaseNodeSchema.extend({
  type: z.literal("humanInput"),
  config: z
    .object({
      /** Shown to the reviewer; supports `{{nodeId.path}}` variables. */
      prompt: z.string().default("请审核以下内容并选择操作。"),
      actions: z
        .array(HumanInputActionSchema)
        .default([
          { id: "approve", label: "通过", value: "approved" },
          { id: "reject", label: "驳回", value: "rejected" },
        ]),
      /** When enabled, the reviewer can submit free text (emits `__input__`). */
      allowTextInput: z.boolean().default(false),
      inputLabel: z.string().optional(),
      /** Optional default text for the editable field; supports variables. */
      defaultText: z.string().optional(),
    })
    .default({
      prompt: "请审核以下内容并选择操作。",
      actions: [
        { id: "approve", label: "通过", value: "approved" },
        { id: "reject", label: "驳回", value: "rejected" },
      ],
      allowTextInput: false,
    })
    .superRefine((config, context) => {
      const ids = new Set<string>();
      for (const [index, action] of config.actions.entries()) {
        if (action.id === HUMAN_INPUT_TEXT_ACTION_ID) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Action id "${HUMAN_INPUT_TEXT_ACTION_ID}" is reserved for text submissions.`,
            path: ["actions", index, "id"],
          });
        }
        if (ids.has(action.id)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate action id "${action.id}".`,
            path: ["actions", index, "id"],
          });
        }
        ids.add(action.id);
      }
      if (config.actions.length === 0 && !config.allowTextInput) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Human Input needs at least one action button or text input enabled.",
          path: ["actions"],
        });
      }
    }),
});

/**
 * End node. Owns a free-form `answer` Answer Template (literal text interleaved
 * with `{{nodeId.path}}` Variable References). When a run reaches this node the
 * template is resolved against runtime state and becomes the node's final output;
 * an empty `answer` yields an empty output. `note` is retained for back-compat.
 */
const EndNodeSchema = BaseNodeSchema.extend({
  type: z.literal("end"),
  config: z
    .object({
      answer: z.string().default(""),
      note: z.string().optional(),
    })
    .default({}),
});

export const WorkflowNodeSchema = z.discriminatedUnion("type", [
  StartNodeSchema,
  LLMNodeSchema,
  KnowledgeNodeSchema,
  ToolNodeSchema,
  AgentNodeSchema,
  BasicConfigNodeSchema("code"),
  IfElseNodeSchema,
  HumanInputNodeSchema,
  BasicConfigNodeSchema("template"),
  EndNodeSchema,
]);

export const WorkflowEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  /**
   * Which source handle the edge leaves from. Required for multi-output nodes
   * (e.g. If/Else, where each case + the implicit `else` is its own handle).
   * Absent for single-output nodes.
   */
  sourceHandle: z.string().optional(),
  label: z.string().optional(),
});

export const WorkflowFileSchema = z.object({
  version: z.literal("1"),
  metadata: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    // Optional icon key (maps to a lucide icon on the client). Defaults applied
    // in the UI when absent.
    icon: z.string().optional(),
    /** Workflow vs Chat capability. Absent (legacy) = "workflow". */
    mode: WorkflowModeSchema.optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  }),
  graph: z.object({
    nodes: z.array(WorkflowNodeSchema),
    edges: z.array(WorkflowEdgeSchema),
  }),
  settings: z.object({
    modelProvider: OpenAICompatibleSettingsSchema.optional(),
    modelProviderKeys: ModelProviderKeysSchema,
    providerKeyPrefs: ProviderKeyPrefsSchema,
    /** Conversation memory policy (summary-buffer compression). Absent = defaults. */
    memory: MemorySettingsSchema.optional(),
  }),
});

export type StartField = z.infer<typeof StartFieldSchema>;
export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>;
export type StartNode = Extract<WorkflowNode, { type: "start" }>;
export type LLMNode = Extract<WorkflowNode, { type: "llm" }>;
export type KnowledgeNode = Extract<WorkflowNode, { type: "knowledge" }>;
export type ToolNode = Extract<WorkflowNode, { type: "tool" }>;
/** Generic tool config: `{ provider, providerId, toolName, params }` (ADR 0003). */
export type ToolNodeConfig = ToolNode["config"];
export type AgentNode = Extract<WorkflowNode, { type: "agent" }>;
/** Agent config: strategy, instruction/query, inline tool list, loop + memory (ADR 0005). */
export type AgentNodeConfig = AgentNode["config"];
export type IfElseNode = Extract<WorkflowNode, { type: "ifElse" }>;
export type IfElseCase = IfElseNode["config"]["cases"][number];
export type ConditionRow = IfElseCase["conditions"][number];
export type ConditionOperator = z.infer<typeof ConditionOperatorSchema>;
export type HumanInputNode = Extract<WorkflowNode, { type: "humanInput" }>;
export type HumanInputAction = HumanInputNode["config"]["actions"][number];
export type EndNode = Extract<WorkflowNode, { type: "end" }>;
export type WorkflowEdge = z.infer<typeof WorkflowEdgeSchema>;

/**
 * Ordered source-handle ids an If/Else node exposes: one per case, then the
 * implicit `else`. Shared by the canvas (handle rendering) and the runtime
 * (conditional edge routing) so they never drift.
 */
export function ifElseHandleIds(node: IfElseNode): string[] {
  return [...node.config.cases.map((branch) => branch.id), IFELSE_ELSE_HANDLE_ID];
}
export type ModelProvider = z.infer<typeof ModelProviderSchema>;
export type OpenAICompatibleSettings = z.infer<typeof OpenAICompatibleSettingsSchema>;
export type ModelProviderKeys = z.infer<typeof ModelProviderKeysSchema>;
export type UsagePriority = z.infer<typeof UsagePrioritySchema>;
export type ProviderKeyPreference = z.infer<typeof ProviderKeyPreferenceSchema>;
export type ProviderKeyPrefs = z.infer<typeof ProviderKeyPrefsSchema>;
export type LLMModelSettings = z.infer<typeof LLMModelSettingsSchema>;
export type WorkflowFile = z.infer<typeof WorkflowFileSchema>;

export type WorkflowNodeOutputField = {
  name: string;
  type: string;
  description: string;
  children?: WorkflowNodeOutputField[];
};

export function workflowNodeOutputFields(type: WorkflowNodeType): WorkflowNodeOutputField[] {
  const fields: Partial<Record<WorkflowNodeType, WorkflowNodeOutputField[]>> = {
    start: [],
    llm: [
      { name: "text", type: "string", description: "Generated text" },
      { name: "usage", type: "object", description: "Provider token usage" },
      { name: "reasoning", type: "object", description: "Provider reasoning metadata" },
    ],
    knowledge: [
      {
        name: "result",
        type: "Array[Object]",
        description: "Retrieval segmented data",
        children: [
          { name: "content", type: "string", description: "Segmented content" },
          { name: "title", type: "string", description: "Segmented title" },
          { name: "url", type: "string", description: "Segmented URL" },
          { name: "icon", type: "string", description: "Segmented icon" },
          { name: "metadata", type: "object", description: "Other metadata" },
          { name: "files", type: "Array[File]", description: "Retrieved files" },
        ],
      },
      { name: "context", type: "string", description: "Retrieved context text" },
      { name: "query", type: "string", description: "Resolved retrieval query" },
    ],
    tool: [
      { name: "text", type: "string", description: "Tool output text" },
      { name: "data", type: "object", description: "Tool output data" },
    ],
    agent: [
      { name: "text", type: "string", description: "Final answer" },
      { name: "usage", type: "object", description: "Aggregated token usage" },
      {
        name: "data",
        type: "object",
        description: "Agent run data",
        children: [{ name: "steps", type: "Array[Object]", description: "Tool-call trace (name, args, result)" }],
      },
    ],
    ifElse: [{ name: "matched", type: "string", description: "Id of the matched branch (case id or \"else\")" }],
    humanInput: [
      { name: "action_id", type: "string", description: "Chosen action id (or \"__input__\" for free text)" },
      { name: "action_value", type: "string", description: "Chosen action value (or the submitted text)" },
    ],
  };
  return fields[type] ?? [];
}

export function isWorkflowNodeOutputPath(type: WorkflowNodeType, path: string[]): boolean {
  const [first] = path;
  if (!first) {
    return false;
  }
  return workflowNodeOutputFields(type).some((field) => field.name === first);
}

/**
 * Reserved node id of the `userInput` Ambient Variable namespace (see CONTEXT.md /
 * ADR 0002). Exposed only in Chat Mode and available to every node regardless of
 * graph topology. No real node may use this id (`createReadableNodeId` only mints
 * `<type><n>` ids, so collisions can't occur).
 */
export const USER_INPUT_NAMESPACE = "userInput";

/** Display label for the `userInput` ambient namespace in Variable Tags/pickers. */
export const USER_INPUT_LABEL = "User Input";

/**
 * Ambient `userInput` fields. `query` is the current chat message (selectable);
 * `files` is reserved for deferred multimodal input (not selectable yet).
 */
export const USER_INPUT_FIELDS: WorkflowNodeOutputField[] = [
  { name: "query", type: "string", description: "Current chat message" },
  { name: "files", type: "Array[File]", description: "Uploaded files (reserved, deferred)" },
];

/** Whether a workflow runs as a multi-turn chatbot (Chat Mode). */
export function isChatWorkflow(file: WorkflowFile): boolean {
  return file.metadata.mode === "chat";
}

/** Summary-buffer defaults applied when `settings.memory` is absent or partial. */
export function resolveMemorySettings(file: WorkflowFile): MemorySettings {
  return MemorySettingsSchema.parse(file.settings.memory ?? {});
}

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; error: string };

export function validateWorkflowFile(value: unknown): ValidationResult<WorkflowFile> {
  const result = WorkflowFileSchema.safeParse(value);
  if (result.success) {
    return { ok: true, data: result.data };
  }

  return {
    ok: false,
    error: result.error.issues.map((issue) => `${issue.path.join(".") || "file"}: ${issue.message}`).join("; "),
  };
}

export function parseWorkflowJson(content: string): ValidationResult<WorkflowFile> {
  try {
    return validateWorkflowFile(JSON.parse(content));
  } catch (error) {
    return { ok: false, error: `Invalid JSON: ${(error as Error).message}` };
  }
}

export function serializeWorkflowFile(workflow: WorkflowFile): string {
  const modelProvider = workflow.settings.modelProvider
    ? {
        ...workflow.settings.modelProvider,
        apiKey: undefined,
      }
    : undefined;
  const legacyProviderKey = workflow.settings.modelProvider?.apiKey;
  const modelProviderKeys =
    legacyProviderKey && workflow.settings.modelProvider
      ? {
          ...workflow.settings.modelProviderKeys,
          [workflow.settings.modelProvider.provider]:
            workflow.settings.modelProviderKeys?.[workflow.settings.modelProvider.provider] || legacyProviderKey,
        }
      : workflow.settings.modelProviderKeys;
  const sanitized: WorkflowFile = {
    ...workflow,
    metadata: {
      ...workflow.metadata,
      updatedAt: new Date().toISOString(),
    },
    settings: {
      ...workflow.settings,
      modelProvider,
      modelProviderKeys,
    },
  };

  return `${JSON.stringify(sanitized, null, 2)}\n`;
}

export function getProviderApiKey(workflow: WorkflowFile, provider: ModelProvider): string | undefined {
  return workflow.settings.modelProviderKeys?.[provider] || legacyModelProviderApiKey(workflow, provider);
}

export function resolveLLMModelSettings(workflow: WorkflowFile, node: LLMNode): LLMModelSettings | undefined {
  const workflowSettings = workflow.settings.modelProvider;
  const nodeSettings = node.config.modelSettings;
  const provider = nodeSettings?.provider || workflowSettings?.provider;

  if (!provider) {
    return undefined;
  }

  const baseURL = nodeSettings?.baseURL || workflowSettings?.baseURL;
  const model = nodeSettings?.model || node.config.model || workflowSettings?.model;

  if (!baseURL || !model) {
    return undefined;
  }

  return {
    provider,
    baseURL,
    model,
    apiKey: nodeSettings?.apiKey || getProviderApiKey(workflow, provider),
    temperature: nodeSettings?.temperature ?? workflowSettings?.temperature ?? node.config.temperature,
    maxTokens: nodeSettings?.maxTokens ?? workflowSettings?.maxTokens ?? node.config.maxTokens,
  };
}

function legacyModelProviderApiKey(workflow: WorkflowFile, provider: ModelProvider): string | undefined {
  const settings = workflow.settings.modelProvider;
  return settings?.provider === provider ? settings.apiKey : undefined;
}

/**
 * Well-known id of the seeded read-only Chinese customer-support example KB.
 * Anonymous users can read it; the demo workflow below queries it. The server
 * seed (`apps/server/src/knowledge/constants.ts`) re-exports this constant so
 * the workflow fixture and storage layer never drift.
 */
export const EXAMPLE_KNOWLEDGE_BASE_ID = "kb_customer_support_example";

export function createDefaultWorkflow(): WorkflowFile {
  const now = new Date().toISOString();
  return {
    version: "1",
    metadata: {
      name: "Untitled Agent Workflow",
      description: "Local workflow debug project.",
      createdAt: now,
      updatedAt: now,
    },
    graph: {
      nodes: [
        {
          id: "start1",
          type: "start",
          label: "Start",
          description: "Collect the inputs that seed this workflow run.",
          position: { x: 80, y: 120 },
          config: {
            fields: [
              {
                name: "topic",
                label: "Topic",
                required: true,
                defaultValue: "cat",
              },
            ],
          },
        },
        {
          id: "llm1",
          type: "llm",
          label: "LLM",
          description: "Generate a response from the configured model.",
          position: { x: 360, y: 110 },
          config: {
            messages: [
              { role: "system", content: "You are a chat bot" },
              { role: "user", content: "Tell me a joke about {{start1.topic}}" },
            ],
            variables: {},
            temperature: 0.7,
            maxTokens: 800,
            memory: false,
          },
        }
      ],
      edges: [{ id: "edge-start-llm", source: "start1", target: "llm1" }],
    },
    settings: {
      modelProvider: {
        provider: "deepseek",
        baseURL: "https://api.deepseek.com",
        model: "deepseek-v4-flash",
      },
      modelProviderKeys: {},
      providerKeyPrefs: {},
    },
  };
}
/**
 * Chinese customer-support RAG demo for anonymous users. It chains
 * Start → Knowledge → LLM so a question flows into a retrieval query against the
 * seeded example KB and the retrieved `context` feeds the answer prompt:
 *
 * - Start collects `customerQuestion`.
 * - Knowledge queries the example KB with `{{start1.customerQuestion}}`.
 * - LLM grounds its reply on `{{knowledge1.context}}`.
 */
export function createKnowledgeDemoWorkflow(): WorkflowFile {
  const now = new Date().toISOString();
  return {
    version: "1",
    metadata: {
      name: "云舵客服 RAG 演示",
      description: "基于示例知识库的中文客服问答演示：问题经知识检索后再生成回答。",
      icon: "bot",
      createdAt: now,
      updatedAt: now,
    },
    graph: {
      nodes: [
        {
          id: "start1",
          type: "start",
          label: "Start",
          description: "收集客户问题，作为本次问答的输入。",
          position: { x: 80, y: 160 },
          config: {
            fields: [
              {
                name: "customerQuestion",
                label: "客户问题",
                required: true,
                defaultValue: "我想申请退款，请问退款政策是怎样的？",
              },
            ],
          },
        },
        {
          id: "knowledge1",
          type: "knowledge",
          label: "Knowledge",
          description: "在「云舵客服知识库」中检索与客户问题最相关的资料。",
          position: { x: 360, y: 150 },
          config: {
            knowledgeBaseIds: [EXAMPLE_KNOWLEDGE_BASE_ID],
            queryTemplate: "{{start1.customerQuestion}}",
            retrieval: { mode: "semantic", topK: 5 },
          },
        },
        {
          id: "llm1",
          type: "llm",
          label: "LLM",
          description: "依据检索到的资料回答客户问题。",
          position: { x: 640, y: 140 },
          config: {
            messages: [
              {
                role: "system",
                content:
                  "你是云舵的智能客服助手。只能依据提供的知识库资料回答用户问题；如果资料中没有相关信息，请明确告知无法确认，并建议用户联系人工客服。回答要简洁、准确、有礼貌。",
              },
              {
                role: "user",
                content:
                  "知识库资料：\n{{knowledge1.context}}\n\n用户问题：{{start1.customerQuestion}}\n\n请基于以上资料用中文回答用户问题。",
              },
            ],
            variables: {},
            temperature: 0.3,
            maxTokens: 800,
            memory: false,
          },
        },
      ],
      edges: [
        { id: "edge-start-knowledge", source: "start1", target: "knowledge1" },
        { id: "edge-knowledge-llm", source: "knowledge1", target: "llm1" },
      ],
    },
    settings: {
      modelProvider: {
        provider: "deepseek",
        baseURL: "https://api.deepseek.com",
        model: "deepseek-v4-flash",
      },
      modelProviderKeys: {},
      providerKeyPrefs: {},
    },
  };
}

/**
 * Customer-support bot with human review. Extends the RAG demo with a
 * deterministic branch and a human-in-the-loop step:
 *
 * - Start collects `customerQuestion`.
 * - Knowledge retrieves from the seeded example KB.
 * - LLM drafts a grounded reply (conversation memory on).
 * - If/Else routes refund/complaint questions to human review; everything else
 *   is auto-replied. The condition is a deterministic keyword match.
 * - Human Input shows the draft for a reviewer to approve / reject / edit.
 *
 * Runs on AI credits (deepseek), so signed-in users with a grant can run the
 * whole flow — including the human-review pause/resume.
 */
export function createSupportBotWithReviewWorkflow(): WorkflowFile {
  const now = new Date().toISOString();
  return {
    version: "1",
    metadata: {
      name: "客服机器人（含人工复核）",
      description: "退款/投诉类问题自动转人工复核，其余自动回复；基于示例知识库，带对话记忆。",
      icon: "userCheck",
      createdAt: now,
      updatedAt: now,
    },
    graph: {
      nodes: [
        {
          id: "start1",
          type: "start",
          label: "Start",
          description: "收集客户问题。",
          position: { x: 80, y: 200 },
          config: {
            fields: [
              {
                name: "customerQuestion",
                label: "客户问题",
                required: true,
                defaultValue: "我想申请退款，请问退款政策是怎样的？",
              },
            ],
          },
        },
        {
          id: "knowledge1",
          type: "knowledge",
          label: "Knowledge",
          description: "在「云舵客服知识库」中检索相关资料。",
          position: { x: 340, y: 190 },
          config: {
            knowledgeBaseIds: [EXAMPLE_KNOWLEDGE_BASE_ID],
            queryTemplate: "{{start1.customerQuestion}}",
            retrieval: { mode: "semantic", topK: 5 },
          },
        },
        {
          id: "llm1",
          type: "llm",
          label: "LLM",
          description: "依据检索资料草拟回复（开启对话记忆）。",
          position: { x: 600, y: 190 },
          config: {
            messages: [
              {
                role: "system",
                content:
                  "你是云舵的智能客服助手。只能依据提供的知识库资料回答用户问题；如果资料中没有相关信息，请明确告知无法确认。回答要简洁、准确、有礼貌。",
              },
              {
                role: "user",
                content:
                  "知识库资料：\n{{knowledge1.context}}\n\n用户问题：{{start1.customerQuestion}}\n\n请基于以上资料用中文草拟一条回复。",
              },
            ],
            variables: {},
            temperature: 0.3,
            maxTokens: 800,
            memory: true,
          },
        },
        {
          id: "ifElse1",
          type: "ifElse",
          label: "需要人工复核？",
          description: "退款/投诉类问题转人工，其余自动回复。",
          position: { x: 880, y: 190 },
          config: {
            cases: [
              {
                id: "needsReview",
                combinator: "or",
                conditions: [
                  { variable: "{{start1.customerQuestion}}", operator: "contains", value: "退款" },
                  { variable: "{{start1.customerQuestion}}", operator: "contains", value: "投诉" },
                ],
              },
            ],
          },
        },
        {
          id: "humanInput1",
          type: "humanInput",
          label: "人工复核",
          description: "审核员复核草拟回复，可通过、驳回或改写。",
          position: { x: 1180, y: 90 },
          config: {
            prompt:
              "请复核以下草拟回复（客户问题：{{start1.customerQuestion}}）：\n\n{{llm1.text}}",
            actions: [
              { id: "approve", label: "通过", value: "approved" },
              { id: "reject", label: "驳回", value: "rejected" },
            ],
            allowTextInput: true,
            inputLabel: "修改后的回复",
          },
        },
        {
          id: "endReview",
          type: "end",
          label: "人工已确认",
          position: { x: 1460, y: 90 },
          config: { answer: "" },
        },
        {
          id: "endAuto",
          type: "end",
          label: "自动回复已发送",
          position: { x: 1180, y: 320 },
          config: { answer: "" },
        },
      ],
      edges: [
        { id: "edge-start-knowledge", source: "start1", target: "knowledge1" },
        { id: "edge-knowledge-llm", source: "knowledge1", target: "llm1" },
        { id: "edge-llm-ifelse", source: "llm1", target: "ifElse1" },
        { id: "edge-ifelse-review", source: "ifElse1", target: "humanInput1", sourceHandle: "needsReview" },
        { id: "edge-ifelse-auto", source: "ifElse1", target: "endAuto", sourceHandle: "else" },
        { id: "edge-review-end", source: "humanInput1", target: "endReview" },
      ],
    },
    settings: {
      modelProvider: {
        provider: "deepseek",
        baseURL: "https://api.deepseek.com",
        model: "deepseek-v4-flash",
      },
      modelProviderKeys: {},
      providerKeyPrefs: {},
    },
  };
}

/**
 * Agent tool-routing demo. It keeps the graph intentionally small so the Agent
 * node's inline Agent Tool List is the visible point: one built-in tool plus one
 * Built-in MCP Server tool.
 */
export function createAgentToolsDemoWorkflow(): WorkflowFile {
  const now = new Date().toISOString();
  return {
    version: "1",
    metadata: {
      name: "Agent 工具调度演示",
      description: "Agent 在一个节点内同时使用内置工具和 Built-in MCP 工具，完成工具选择与回答。",
      icon: "bot",
      createdAt: now,
      updatedAt: now,
    },
    graph: {
      nodes: [
        {
          id: "start1",
          type: "start",
          label: "Start",
          description: "收集要交给 Agent 处理的问题。",
          position: { x: 80, y: 160 },
          config: {
            fields: [
              {
                name: "request",
                label: "任务",
                required: true,
                defaultValue: "请先获取当前时间，再调用 MCP 示例工具说明云舵如何接入外部工具。",
              },
            ],
          },
        },
        {
          id: "agent1",
          type: "agent",
          label: "Agent",
          description: "自主选择 Current Time 和 Built-in MCP 工具，并整合为回答。",
          position: { x: 360, y: 150 },
          config: {
            strategy: "functionCalling",
            instruction:
              "你是云舵工作流的工具调度演示 Agent。根据用户任务决定是否调用工具；需要时间信息时调用 Current Time，需要说明 MCP 能力时调用 Built-in MCP 工具。回答要简洁，并明确列出你使用过的工具。",
            query: "{{start1.request}}",
            tools: [
              {
                provider: "builtin",
                providerId: "builtin",
                toolName: "currentTime",
                params: { timezone: "Asia/Shanghai" },
              },
              { provider: "mcp", providerId: "builtin", toolName: "get_demo_fact", params: {} },
            ],
            maxIterations: 6,
            memory: false,
            temperature: 0.2,
            maxTokens: 900,
          },
        },
        {
          id: "end1",
          type: "end",
          label: "完成",
          description: "输出 Agent 的最终回答。",
          position: { x: 640, y: 150 },
          config: { answer: "{{agent1.text}}" },
        },
      ],
      edges: [
        { id: "edge-start-agent", source: "start1", target: "agent1" },
        { id: "edge-agent-end", source: "agent1", target: "end1" },
      ],
    },
    settings: {
      modelProvider: {
        provider: "deepseek",
        baseURL: "https://api.deepseek.com",
        model: "deepseek-v4-flash",
      },
      modelProviderKeys: {},
      providerKeyPrefs: {},
    },
  };
}

/**
 * Customer-support Agent demo. It extends the seeded support-domain examples with
 * Knowledge retrieval before the Agent, while the Agent itself owns both built-in
 * and MCP tools in its inline tool list.
 */
export function createSupportAgentWorkflow(): WorkflowFile {
  const now = new Date().toISOString();
  return {
    version: "1",
    metadata: {
      name: "客服 Agent（工具 + MCP）",
      description: "基于示例知识库检索客户问题，再由 Agent 调用内置工具和 Built-in MCP 工具生成回复。",
      icon: "bot",
      createdAt: now,
      updatedAt: now,
    },
    graph: {
      nodes: [
        {
          id: "start1",
          type: "start",
          label: "Start",
          description: "收集客户问题。",
          position: { x: 80, y: 180 },
          config: {
            fields: [
              {
                name: "customerQuestion",
                label: "客户问题",
                required: true,
                defaultValue: "我想申请退款，请问今天提交大概多久能处理？",
              },
            ],
          },
        },
        {
          id: "knowledge1",
          type: "knowledge",
          label: "Knowledge",
          description: "在「云舵客服知识库」中检索相关资料。",
          position: { x: 340, y: 170 },
          config: {
            knowledgeBaseIds: [EXAMPLE_KNOWLEDGE_BASE_ID],
            queryTemplate: "{{start1.customerQuestion}}",
            retrieval: { mode: "semantic", topK: 5 },
          },
        },
        {
          id: "agent1",
          type: "agent",
          label: "客服 Agent",
          description: "结合知识库上下文，自主调用工具补充时间和 MCP 示例信息。",
          position: { x: 620, y: 160 },
          config: {
            strategy: "functionCalling",
            instruction:
              "你是云舵的客服 Agent。先依据知识库资料回答客户问题；需要当前时间或时区信息时调用 Current Time；需要说明系统外部工具能力时调用 Built-in MCP 工具。不要编造知识库没有的信息，无法确认时建议联系人工客服。",
            query:
              "知识库资料：\n{{knowledge1.context}}\n\n客户问题：{{start1.customerQuestion}}\n\n请给出简洁、准确、有礼貌的中文回复。",
            tools: [
              {
                provider: "builtin",
                providerId: "builtin",
                toolName: "currentTime",
                params: { timezone: "Asia/Shanghai" },
              },
              { provider: "mcp", providerId: "builtin", toolName: "get_demo_fact", params: {} },
            ],
            maxIterations: 6,
            memory: true,
            temperature: 0.3,
            maxTokens: 900,
          },
        },
        {
          id: "end1",
          type: "end",
          label: "客服回复",
          description: "输出客服 Agent 的最终回复。",
          position: { x: 900, y: 160 },
          config: { answer: "{{agent1.text}}" },
        },
      ],
      edges: [
        { id: "edge-start-knowledge", source: "start1", target: "knowledge1" },
        { id: "edge-knowledge-agent", source: "knowledge1", target: "agent1" },
        { id: "edge-agent-end", source: "agent1", target: "end1" },
      ],
    },
    settings: {
      modelProvider: {
        provider: "deepseek",
        baseURL: "https://api.deepseek.com",
        model: "deepseek-v4-flash",
      },
      modelProviderKeys: {},
      providerKeyPrefs: {},
    },
  };
}

export function createReadableNodeId(type: WorkflowNodeType, existingNodes: Pick<WorkflowNode, "id">[] = []): string {
  const base = type;
  const existingIds = new Set(existingNodes.map((node) => node.id));
  let index = 1;

  while (existingIds.has(`${base}${index}`)) {
    index += 1;
  }

  return `${base}${index}`;
}

export function createNode(
  type: WorkflowNodeType,
  position: { x: number; y: number },
  existingNodes: Pick<WorkflowNode, "id">[] = [],
): WorkflowNode {
  const id = createReadableNodeId(type, existingNodes);
  const base = { id, type, position, label: nodeTypeLabel(type), description: nodeTypeDescription(type) };

  if (type === "llm") {
    return {
      ...base,
      type,
      config: {
        messages: [
          { role: "system", content: "You are a precise workflow debugging assistant." },
          { role: "user", content: "Explain {{start1.topic}} in one concise paragraph." },
        ],
        variables: {},
        temperature: 0.7,
        maxTokens: 800,
        memory: false,
      },
    };
  }

  if (type === "tool") {
    return {
      ...base,
      label: "Current Time",
      type,
      config: { provider: "builtin", providerId: "builtin", toolName: "currentTime", params: { timezone: "UTC" } },
    };
  }

  if (type === "knowledge") {
    return {
      ...base,
      type,
      config: {
        knowledgeBaseIds: [],
        queryTemplate: "{{start1.topic}}",
        retrieval: { mode: "semantic", topK: 5 },
      },
    };
  }

  if (type === "start") {
    return {
      ...base,
      type,
      config: { fields: [] },
    };
  }

  if (type === "ifElse") {
    return {
      ...base,
      type,
      config: {
        cases: [{ id: "case-1", combinator: "and", conditions: [{ variable: "", operator: "equals", value: "" }] }],
      },
    };
  }

  if (type === "humanInput") {
    return {
      ...base,
      label: "Human Input",
      type,
      config: {
        prompt: "请审核以下内容并选择操作：\n{{llm1.text}}",
        actions: [
          { id: "approve", label: "通过", value: "approved" },
          { id: "reject", label: "驳回", value: "rejected" },
        ],
        allowTextInput: false,
      },
    };
  }

  if (type === "agent") {
    return {
      ...base,
      type,
      config: {
        strategy: "functionCalling",
        instruction: "",
        query: "{{userInput.query}}",
        tools: [],
        maxIterations: 5,
        memory: false,
        temperature: 0.7,
        maxTokens: 800,
      },
    };
  }

  return {
    ...base,
    type,
    config: {},
  } as WorkflowNode;
}

/**
 * Deep-clones an existing node for Duplicate/Paste: fresh readable id, a copy of
 * its config (so the clone is fully independent), and a position offset so it
 * doesn't sit exactly on top of the original. Carries no edges.
 */
export function cloneNode(
  node: WorkflowNode,
  existingNodes: Pick<WorkflowNode, "id">[] = [],
  offset: { x: number; y: number } = { x: 40, y: 40 },
): WorkflowNode {
  const cloned = structuredClone(node) as WorkflowNode;
  return {
    ...cloned,
    id: createReadableNodeId(node.type, existingNodes),
    position: { x: node.position.x + offset.x, y: node.position.y + offset.y },
  };
}

export function nodeTypeLabel(type: WorkflowNodeType): string {
  const labels: Record<WorkflowNodeType, string> = {
    start: "Start",
    llm: "LLM",
    knowledge: "Knowledge",
    tool: "Tool",
    agent: "Agent",
    code: "Code",
    ifElse: "If/Else",
    humanInput: "Human Input",
    template: "Template",
    end: "End",
  };
  return labels[type];
}

export function conditionOperatorLabel(operator: ConditionOperator): string {
  const labels: Record<ConditionOperator, string> = {
    equals: "equals",
    notEquals: "not equals",
    contains: "contains",
    notContains: "not contains",
    isEmpty: "is empty",
    isNotEmpty: "is not empty",
    gt: "greater than",
    gte: "greater or equal",
    lt: "less than",
    lte: "less or equal",
  };
  return labels[operator];
}

export function isValuelessOperator(operator: ConditionOperator): boolean {
  return (VALUELESS_CONDITION_OPERATORS as readonly string[]).includes(operator);
}

export function nodeTypeDescription(type: WorkflowNodeType): string {
  const descriptions: Record<WorkflowNodeType, string> = {
    start: "Collect the inputs that seed this workflow run.",
    llm: "Generate a response from the configured model.",
    knowledge: "Provide external context for downstream nodes.",
    tool: "Call a configured tool through the runtime boundary.",
    agent: "Let a model call tools in a loop to reach an answer.",
    code: "Run custom transformation logic.",
    ifElse: "Branch the workflow based on a condition.",
    humanInput: "Pause for a human to review and choose an action.",
    template: "Shape variables into reusable text.",
    end: "Mark the workflow output boundary.",
  };
  return descriptions[type];
}
