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

const LLMNodeSchema = BaseNodeSchema.extend({
  type: z.literal("llm"),
  config: z.object({
    systemPrompt: z.string().optional(),
    userPrompt: z.string().default("Write a short response for {{topic}}."),
    variables: z.record(z.string()).default({ topic: "workflow debugging" }),
    model: z.string().optional(),
    temperature: z.number().min(0).max(2).default(0.7),
    maxTokens: z.number().int().positive().max(32000).default(800),
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

export const OpenAICompatibleSettingsSchema = z.object({
  baseURL: z.string().url().default("http://127.0.0.1:8787/v1"),
  apiKey: z.string().optional(),
  model: z.string().min(1).default("mock-gpt"),
});

export const WorkflowFileSchema = z.object({
  version: z.literal("1"),
  metadata: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  }),
  graph: z.object({
    nodes: z.array(WorkflowNodeSchema),
    edges: z.array(WorkflowEdgeSchema),
  }),
  settings: z.object({
    modelProvider: OpenAICompatibleSettingsSchema.optional(),
  }),
});

export type StartField = z.infer<typeof StartFieldSchema>;
export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>;
export type StartNode = Extract<WorkflowNode, { type: "start" }>;
export type LLMNode = Extract<WorkflowNode, { type: "llm" }>;
export type ToolNode = Extract<WorkflowNode, { type: "tool" }>;
export type WorkflowEdge = z.infer<typeof WorkflowEdgeSchema>;
export type OpenAICompatibleSettings = z.infer<typeof OpenAICompatibleSettingsSchema>;
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
  const sanitized: WorkflowFile = {
    ...workflow,
    metadata: {
      ...workflow.metadata,
      updatedAt: new Date().toISOString(),
    },
    settings: {
      ...workflow.settings,
      modelProvider: workflow.settings.modelProvider
        ? {
            ...workflow.settings.modelProvider,
            apiKey: undefined,
          }
        : undefined,
    },
  };

  return `${JSON.stringify(sanitized, null, 2)}\n`;
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
          position: { x: 80, y: 120 },
          config: {
            fields: [
              {
                name: "topic",
                label: "Topic",
                required: true,
                defaultValue: "LLM workflow debugging",
              },
            ],
          },
        },
        {
          id: "llm1",
          type: "llm",
          label: "LLM",
          position: { x: 360, y: 110 },
          config: {
            systemPrompt: "You are a precise workflow debugging assistant.",
            userPrompt: "Explain {{start1.topic}} in one concise paragraph.",
            variables: {},
            temperature: 0.7,
            maxTokens: 800,
          },
        },
        {
          id: "tool-current-time",
          type: "tool",
          label: "Current Time",
          position: { x: 360, y: 320 },
          config: { adapter: "currentTime", timezone: "UTC" },
        },
      ],
      edges: [{ id: "edge-start-llm", source: "start1", target: "llm1" }],
    },
    settings: {
      modelProvider: {
        baseURL: "http://127.0.0.1:8787/v1",
        model: "mock-gpt",
      },
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
  const base = { id, type, position, label: nodeTypeLabel(type) };

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
