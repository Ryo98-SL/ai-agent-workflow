import { z } from "zod";

export const NODE_TYPES = [
  "start",
  "llm",
  "knowledge",
  "tool",
  "code",
  "ifElse",
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

const ToolNodeSchema = BaseNodeSchema.extend({
  type: z.literal("tool"),
  config: z.object({
    adapter: z.literal("currentTime").default("currentTime"),
    timezone: z.string().default("UTC"),
  }),
});

const BasicConfigNodeSchema = <Type extends Exclude<WorkflowNodeType, "start" | "llm" | "tool">>(
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

export const LLMModelSettingsSchema = OpenAICompatibleSettingsSchema;

const LLMNodeSchema = BaseNodeSchema.extend({
  type: z.literal("llm"),
  config: z.object({
    systemPrompt: z.string().optional(),
    userPrompt: z.string().default("Write a short response for {{topic}}."),
    variables: z.record(z.string()).default({ topic: "workflow debugging" }),
    model: z.string().optional(),
    modelSettings: LLMModelSettingsSchema.optional(),
    temperature: z.number().min(0).max(2).default(0.7),
    maxTokens: z.number().int().positive().max(32000).default(800),
  }),
});

export const WorkflowNodeSchema = z.discriminatedUnion("type", [
  StartNodeSchema,
  LLMNodeSchema,
  ToolNodeSchema,
  BasicConfigNodeSchema("knowledge"),
  BasicConfigNodeSchema("code"),
  BasicConfigNodeSchema("ifElse"),
  BasicConfigNodeSchema("template"),
  BasicConfigNodeSchema("end"),
]);

export const WorkflowEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
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
  }),
});

export type StartField = z.infer<typeof StartFieldSchema>;
export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>;
export type StartNode = Extract<WorkflowNode, { type: "start" }>;
export type LLMNode = Extract<WorkflowNode, { type: "llm" }>;
export type ToolNode = Extract<WorkflowNode, { type: "tool" }>;
export type WorkflowEdge = z.infer<typeof WorkflowEdgeSchema>;
export type ModelProvider = z.infer<typeof ModelProviderSchema>;
export type OpenAICompatibleSettings = z.infer<typeof OpenAICompatibleSettingsSchema>;
export type ModelProviderKeys = z.infer<typeof ModelProviderKeysSchema>;
export type UsagePriority = z.infer<typeof UsagePrioritySchema>;
export type ProviderKeyPreference = z.infer<typeof ProviderKeyPreferenceSchema>;
export type ProviderKeyPrefs = z.infer<typeof ProviderKeyPrefsSchema>;
export type LLMModelSettings = z.infer<typeof LLMModelSettingsSchema>;
export type WorkflowFile = z.infer<typeof WorkflowFileSchema>;

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
            systemPrompt: "You are a chat bot",
            userPrompt: "Tell me a joke about {{start1.topic}}",
            variables: {},
            temperature: 0.7,
            maxTokens: 800,
          },
        }
      ],
      edges: [{ id: "edge-start-llm", source: "start1", target: "llm1" }],
    },
    settings: {
      modelProvider: {
        provider: "ollama",
        baseURL: "http://127.0.0.1:11434",
        model: "qwen3.5:0.8b",
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
        systemPrompt: "You are a precise workflow debugging assistant.",
        userPrompt: "Explain {{start1.topic}} in one concise paragraph.",
        variables: {},
        temperature: 0.7,
        maxTokens: 800,
      },
    };
  }

  if (type === "tool") {
    return {
      ...base,
      label: "Current Time",
      type,
      config: { adapter: "currentTime", timezone: "UTC" },
    };
  }

  if (type === "start") {
    return {
      ...base,
      type,
      config: { fields: [] },
    };
  }

  return {
    ...base,
    type,
    config: {},
  } as WorkflowNode;
}

export function nodeTypeLabel(type: WorkflowNodeType): string {
  const labels: Record<WorkflowNodeType, string> = {
    start: "Start",
    llm: "LLM",
    knowledge: "Knowledge",
    tool: "Tool",
    code: "Code",
    ifElse: "If/Else",
    template: "Template",
    end: "End",
  };
  return labels[type];
}

export function nodeTypeDescription(type: WorkflowNodeType): string {
  const descriptions: Record<WorkflowNodeType, string> = {
    start: "Collect the inputs that seed this workflow run.",
    llm: "Generate a response from the configured model.",
    knowledge: "Provide external context for downstream nodes.",
    tool: "Call a configured tool through the runtime boundary.",
    code: "Run custom transformation logic.",
    ifElse: "Branch the workflow based on a condition.",
    template: "Shape variables into reusable text.",
    end: "Mark the workflow output boundary.",
  };
  return descriptions[type];
}
