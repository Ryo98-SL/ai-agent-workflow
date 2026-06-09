import {
  ModelProviderKeysSchema,
  NODE_TYPES,
  OpenAICompatibleSettingsSchema,
  WorkflowFileSchema,
} from "@ai-agent-workflow/workflow-domain";
import { z } from "zod";

export const API_ROUTE_TEMPLATES = {
  workflows: "/api/workflows",
  workflow: "/api/workflows/:id",
  workflowRuns: "/api/workflows/:id/runs",
  run: "/api/runs/:id",
  runEvents: "/api/runs/:id/events",
  runStream: "/api/runs/:id/stream",
  runResume: "/api/runs/:id/resume",
  providerKeys: "/api/provider-keys",
  providerKeyById: "/api/provider-keys/:id",
  customModels: "/api/custom-models",
  customModel: "/api/custom-models/:id",
  knowledgeBases: "/api/knowledge-bases",
  knowledgeBase: "/api/knowledge-bases/:id",
  knowledgeBaseDocuments: "/api/knowledge-bases/:id/documents",
  knowledgeBaseTextDocuments: "/api/knowledge-bases/:id/documents/text",
  knowledgeBaseFileDocuments: "/api/knowledge-bases/:id/documents/file",
  knowledgeDocument: "/api/knowledge-documents/:id",
  knowledgeDocumentReindex: "/api/knowledge-documents/:id/reindex",
  credits: "/api/credits",
  creditsApply: "/api/credits/apply",
} as const;

const encodePathSegment = (value: string) => encodeURIComponent(value);

export const apiPaths = {
  workflows: () => API_ROUTE_TEMPLATES.workflows,
  workflow: (id: string) => `/api/workflows/${encodePathSegment(id)}`,
  workflowRuns: (id: string) => `/api/workflows/${encodePathSegment(id)}/runs`,
  run: (id: string) => `/api/runs/${encodePathSegment(id)}`,
  runEvents: (id: string) => `/api/runs/${encodePathSegment(id)}/events`,
  runStream: (id: string) => `/api/runs/${encodePathSegment(id)}/stream`,
  runResume: (id: string) => `/api/runs/${encodePathSegment(id)}/resume`,
  providerKeys: () => API_ROUTE_TEMPLATES.providerKeys,
  providerKeyById: (id: string) => `/api/provider-keys/${encodePathSegment(id)}`,
  customModels: () => API_ROUTE_TEMPLATES.customModels,
  customModel: (id: string) => `/api/custom-models/${encodePathSegment(id)}`,
  knowledgeBases: () => API_ROUTE_TEMPLATES.knowledgeBases,
  knowledgeBase: (id: string) => `/api/knowledge-bases/${encodePathSegment(id)}`,
  knowledgeBaseDocuments: (id: string) => `/api/knowledge-bases/${encodePathSegment(id)}/documents`,
  knowledgeBaseTextDocuments: (id: string) => `/api/knowledge-bases/${encodePathSegment(id)}/documents/text`,
  knowledgeBaseFileDocuments: (id: string) => `/api/knowledge-bases/${encodePathSegment(id)}/documents/file`,
  knowledgeDocument: (id: string) => `/api/knowledge-documents/${encodePathSegment(id)}`,
  knowledgeDocumentReindex: (id: string) => `/api/knowledge-documents/${encodePathSegment(id)}/reindex`,
  credits: () => API_ROUTE_TEMPLATES.credits,
  creditsApply: () => API_ROUTE_TEMPLATES.creditsApply,
} as const;

export const ApiIssueSchema = z.object({
  path: z.array(z.union([z.string(), z.number()])),
  message: z.string(),
});

export const ApiErrorCodeSchema = z.enum([
  "bad_request",
  "unauthorized",
  "not_found",
  "method_not_allowed",
  "validation_error",
  "conflict",
  "credits_required",
  "credits_exhausted",
  "internal_error",
]);

export const ApiErrorResponseSchema = z.object({
  error: z.object({
    code: ApiErrorCodeSchema,
    message: z.string(),
    issues: z.array(ApiIssueSchema).optional(),
  }),
});

export const WorkflowIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const RunIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const WorkflowDtoSchema = z.object({
  id: z.string().min(1),
  workflow: WorkflowFileSchema,
});

export const WorkflowSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().optional(),
  updatedAt: z.string().datetime(),
  nodeCount: z.number().int().nonnegative(),
  edgeCount: z.number().int().nonnegative(),
});

export const ListWorkflowsResponseSchema = z.object({
  workflows: z.array(WorkflowSummarySchema),
});

export const CreateWorkflowRequestSchema = z.object({
  workflow: WorkflowFileSchema.optional(),
});

export const CreateWorkflowResponseSchema = z.object({
  workflow: WorkflowDtoSchema,
});

export const GetWorkflowResponseSchema = z.object({
  workflow: WorkflowDtoSchema,
});

export const UpdateWorkflowRequestSchema = z.object({
  workflow: WorkflowFileSchema,
});

export const UpdateWorkflowResponseSchema = z.object({
  workflow: WorkflowDtoSchema,
});

export const RunStatusSchema = z.enum(["queued", "running", "waiting_human", "succeeded", "failed"]);

/** A preset action button offered to the reviewer by a Human Input node. */
export const HumanInputActionDtoSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  value: z.string(),
});

/**
 * The form spec for a paused Human Input interrupt, surfaced so the client can
 * render the reviewer form (on the live stream and on reconnect).
 */
export const RunInterruptSchema = z.object({
  nodeId: z.string().min(1),
  interruptId: z.string().optional(),
  prompt: z.string(),
  actions: z.array(HumanInputActionDtoSchema),
  allowTextInput: z.boolean(),
  inputLabel: z.string().optional(),
  defaultText: z.string().optional(),
});
export const RunInputValueSchema = z.union([z.string(), z.null()]);
export const RunInputSchema = z.record(RunInputValueSchema);

export const CreateRunRequestSchema = z.object({
  input: RunInputSchema.default({}),
  // Stable conversation id shared by a multi-turn chat. Used as the run's
  // LangGraph thread so memory-enabled nodes see prior turns. Defaults to the
  // run id (single-shot) when absent.
  conversationId: z.string().optional(),
  modelProvider: OpenAICompatibleSettingsSchema.optional(),
  modelProviderKeys: ModelProviderKeysSchema.optional(),
  // Active stored-key selection for the run's provider, overriding any saved
  // providerKeyPrefs (covers unsaved/transient selections). Authed-only.
  providerKeyId: z.string().optional(),
  // Inline workflow definition for anonymous/unsaved runs. When present the
  // server executes it directly; otherwise it looks the workflow up by id.
  workflow: WorkflowFileSchema.optional(),
});

export const WorkflowRunOutputSchema = z.object({
  summary: z.string(),
  nodeResults: z.array(
    z.object({
      nodeId: z.string().min(1),
      label: z.string().min(1),
      status: RunStatusSchema,
      output: z.string(),
      data: z.record(z.unknown()).optional(),
    }),
  ),
});

export const WorkflowRunSchema = z.object({
  id: z.string().min(1),
  workflowId: z.string().min(1),
  status: RunStatusSchema,
  input: RunInputSchema,
  output: WorkflowRunOutputSchema.nullable(),
  error: ApiErrorResponseSchema.shape.error.nullable(),
  /** Set when `status === "waiting_human"`: the pending reviewer form. */
  interrupt: RunInterruptSchema.nullish(),
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
});

export const ResumeRunRequestSchema = z.object({
  action_id: z.string().min(1),
  action_value: z.string().default(""),
});

export const ResumeRunResponseSchema = z.object({
  run: WorkflowRunSchema,
});

export const ListWorkflowRunsResponseSchema = z.object({
  runs: z.array(WorkflowRunSchema),
});

export const CreateRunResponseSchema = z.object({
  run: WorkflowRunSchema,
});

export const GetRunResponseSchema = z.object({
  run: WorkflowRunSchema,
});

export const RunEventTypeSchema = z.enum([
  "run.created",
  "run.started",
  "node.completed",
  "node.failed",
  "run.completed",
  "run.failed",
  "run.waiting",
]);

export const RunEventSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  sequence: z.number().int().nonnegative(),
  type: RunEventTypeSchema,
  message: z.string().min(1),
  createdAt: z.string().datetime(),
  payload: z.record(z.unknown()).optional(),
});

export const ListRunEventsResponseSchema = z.object({
  events: z.array(RunEventSchema),
});

const WorkflowNodeTypeSchema = z.enum(NODE_TYPES);

export const RunSseEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("run.started"), runId: z.string() }),
  z.object({
    type: z.literal("node.started"),
    runId: z.string(),
    nodeId: z.string(),
    nodeType: WorkflowNodeTypeSchema,
  }),
  z.object({
    type: z.literal("node.stream"),
    runId: z.string(),
    nodeId: z.string(),
    delta: z.string(),
  }),
  z.object({
    type: z.literal("node.completed"),
    runId: z.string(),
    nodeId: z.string(),
    nodeType: WorkflowNodeTypeSchema,
    output: z.string(),
    data: z.record(z.unknown()).optional(),
    durationMs: z.number(),
    inputTokens: z.number().optional(),
    outputTokens: z.number().optional(),
  }),
  z.object({
    type: z.literal("node.failed"),
    runId: z.string(),
    nodeId: z.string(),
    nodeType: WorkflowNodeTypeSchema,
    error: z.string(),
    durationMs: z.number(),
  }),
  z.object({
    type: z.literal("run.completed"),
    runId: z.string(),
    status: z.enum(["succeeded", "failed"]),
  }),
  z.object({
    type: z.literal("run.waiting"),
    runId: z.string(),
    interrupt: RunInterruptSchema,
  }),
]);

// ---------------------------------------------------------------------------
// Knowledge Bases. User-level reusable RAG resources. Anonymous users can read
// the seeded example KB; mutation endpoints require an authenticated owner.
// ---------------------------------------------------------------------------

export const KnowledgeBaseVisibilitySchema = z.enum(["private", "example"]);
export const KnowledgeDocumentStatusSchema = z.enum(["queued", "chunking", "embedding", "ready", "failed"]);
export const KnowledgeDocumentSourceTypeSchema = z.enum(["text", "file"]);
export const KnowledgeRetrievalModeSchema = z.enum(["semantic", "keyword", "hybrid"]);
export const KnowledgeEmbeddingModeSchema = z.enum(["platform", "userProvider"]);
export const KnowledgeParserTypeSchema = z.enum(["plainText", "markdown", "pdf", "docx"]);

export const KnowledgeEmbeddingSettingsSchema = z.object({
  mode: KnowledgeEmbeddingModeSchema.default("platform"),
  provider: z.string().min(1).default("openai"),
  model: z.string().min(1).default("text-embedding-3-small"),
  providerKeyId: z.string().nullable().optional(),
});

export const KnowledgeChunkingSettingsSchema = z.object({
  strategy: z.literal("recursive").default("recursive"),
  chunkSize: z.number().int().min(200).max(8000).default(800),
  chunkOverlap: z.number().int().min(0).max(2000).default(120),
});

export const KnowledgeRetrievalSettingsSchema = z.object({
  mode: KnowledgeRetrievalModeSchema.default("semantic"),
  topK: z.number().int().min(1).max(20).default(5),
  scoreThreshold: z.number().min(0).max(1).optional(),
});

export const KnowledgeBaseSettingsSchema = z
  .object({
    embedding: KnowledgeEmbeddingSettingsSchema.default({
      mode: "platform",
      provider: "openai",
      model: "text-embedding-3-small",
    }),
    chunking: KnowledgeChunkingSettingsSchema.default({
      strategy: "recursive",
      chunkSize: 800,
      chunkOverlap: 120,
    }),
    retrieval: KnowledgeRetrievalSettingsSchema.default({
      mode: "semantic",
      topK: 5,
      scoreThreshold: 0.3,
    }),
  })
  .default({
    embedding: { mode: "platform", provider: "openai", model: "text-embedding-3-small" },
    chunking: { strategy: "recursive", chunkSize: 800, chunkOverlap: 120 },
    retrieval: { mode: "semantic", topK: 5, scoreThreshold: 0.3 },
  });

export const KnowledgeBaseDtoSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  visibility: KnowledgeBaseVisibilitySchema,
  readOnly: z.boolean(),
  settings: KnowledgeBaseSettingsSchema,
  documentCount: z.number().int().nonnegative(),
  characterCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const KnowledgeDocumentDtoSchema = z.object({
  id: z.string().min(1),
  knowledgeBaseId: z.string().min(1),
  title: z.string().min(1),
  sourceType: KnowledgeDocumentSourceTypeSchema,
  filename: z.string().nullable().optional(),
  mimeType: z.string().nullable().optional(),
  parser: z
    .object({
      type: KnowledgeParserTypeSchema,
      version: z.string().min(1),
    })
    .nullable()
    .optional(),
  characterCount: z.number().int().nonnegative(),
  status: KnowledgeDocumentStatusSchema,
  errorMessage: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const KnowledgeSegmentMetadataSchema = z.object({
  knowledgeBaseId: z.string().min(1),
  documentId: z.string().min(1),
  chunkId: z.string().min(1),
  score: z.number(),
});

export const KnowledgeRetrievalSegmentSchema = z.object({
  content: z.string(),
  title: z.string(),
  url: z.string().nullable(),
  icon: z.string().nullable(),
  metadata: KnowledgeSegmentMetadataSchema,
  files: z.array(z.unknown()).default([]),
});

export const KnowledgeNodeOutputDataSchema = z.object({
  result: z.array(KnowledgeRetrievalSegmentSchema),
  context: z.string(),
  query: z.string(),
});

export const ListKnowledgeBasesResponseSchema = z.object({
  knowledgeBases: z.array(KnowledgeBaseDtoSchema),
});

export const CreateKnowledgeBaseRequestSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  settings: KnowledgeBaseSettingsSchema.optional(),
});

export const CreateKnowledgeBaseResponseSchema = z.object({
  knowledgeBase: KnowledgeBaseDtoSchema,
});

export const GetKnowledgeBaseResponseSchema = z.object({
  knowledgeBase: KnowledgeBaseDtoSchema,
});

export const UpdateKnowledgeBaseRequestSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  settings: KnowledgeBaseSettingsSchema.optional(),
});

export const UpdateKnowledgeBaseResponseSchema = z.object({
  knowledgeBase: KnowledgeBaseDtoSchema,
});

export const ListKnowledgeDocumentsResponseSchema = z.object({
  documents: z.array(KnowledgeDocumentDtoSchema),
});

export const CreateTextKnowledgeDocumentRequestSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1).max(100_000),
  mimeType: z.enum(["text/plain", "text/markdown"]).default("text/plain"),
});

export const CreateFileKnowledgeDocumentRequestSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.enum(["text/plain", "text/markdown", "application/pdf"]),
  sizeBytes: z.number().int().nonnegative().optional(),
  content: z.string().min(1).max(100_000).optional(),
});

export const CreateKnowledgeDocumentResponseSchema = z.object({
  document: KnowledgeDocumentDtoSchema,
});

export const ReindexKnowledgeDocumentResponseSchema = z.object({
  document: KnowledgeDocumentDtoSchema,
});

// ---------------------------------------------------------------------------
// Provider API keys (user-private, server-encrypted). Plaintext is never
// returned to the client — only a masked representation.
// ---------------------------------------------------------------------------

export const ProviderKeyDtoSchema = z.object({
  id: z.string().min(1),
  provider: z.string().min(1),
  label: z.string().min(1),
  last4: z.string(),
  hasKey: z.literal(true),
});

export const ListProviderKeysResponseSchema = z.object({
  keys: z.array(ProviderKeyDtoSchema),
});

export const CreateProviderKeyRequestSchema = z.object({
  provider: z.string().min(1),
  label: z.string().min(1),
  apiKey: z.string().min(1),
});

export const CreateProviderKeyResponseSchema = z.object({
  key: ProviderKeyDtoSchema,
});

// ---------------------------------------------------------------------------
// Custom models (user-private). userId is server-derived, never client-sent.
// ---------------------------------------------------------------------------

export const CustomModelDtoSchema = z.object({
  id: z.string(),
  provider: z.string().min(1),
  model: z.string().min(1),
  baseURL: z.string().url().nullable().optional(),
  label: z.string().nullable().optional(),
  createdAt: z.string(),
});

export const ListCustomModelsResponseSchema = z.object({
  models: z.array(CustomModelDtoSchema),
});

export const CreateCustomModelRequestSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  baseURL: z.string().url().optional(),
  label: z.string().optional(),
});

export const CreateCustomModelResponseSchema = z.object({
  model: CustomModelDtoSchema,
});

// ---------------------------------------------------------------------------
// Credits. A single auto-approved grant per user; token balance metered on runs
// that use the "credits" usage priority.
// ---------------------------------------------------------------------------

export const CreditStatusDtoSchema = z.object({
  status: z.enum(["none", "approved"]),
  grantedTokens: z.number().int().nonnegative().optional(),
  balanceTokens: z.number().int().nonnegative().optional(),
});

export const CreditStatusResponseSchema = CreditStatusDtoSchema;

export type ProviderKeyDto = z.infer<typeof ProviderKeyDtoSchema>;
export type ListProviderKeysResponse = z.infer<typeof ListProviderKeysResponseSchema>;
export type CreateProviderKeyRequest = z.input<typeof CreateProviderKeyRequestSchema>;
export type CreateProviderKeyResponse = z.infer<typeof CreateProviderKeyResponseSchema>;
export type CreditStatusDto = z.infer<typeof CreditStatusDtoSchema>;
export type CreditStatusResponse = z.infer<typeof CreditStatusResponseSchema>;
export type CustomModelDto = z.infer<typeof CustomModelDtoSchema>;
export type ListCustomModelsResponse = z.infer<typeof ListCustomModelsResponseSchema>;
export type CreateCustomModelRequest = z.input<typeof CreateCustomModelRequestSchema>;
export type CreateCustomModelResponse = z.infer<typeof CreateCustomModelResponseSchema>;
export type KnowledgeBaseVisibility = z.infer<typeof KnowledgeBaseVisibilitySchema>;
export type KnowledgeDocumentStatus = z.infer<typeof KnowledgeDocumentStatusSchema>;
export type KnowledgeDocumentSourceType = z.infer<typeof KnowledgeDocumentSourceTypeSchema>;
export type KnowledgeBaseSettings = z.infer<typeof KnowledgeBaseSettingsSchema>;
export type KnowledgeBaseDto = z.infer<typeof KnowledgeBaseDtoSchema>;
export type KnowledgeDocumentDto = z.infer<typeof KnowledgeDocumentDtoSchema>;
export type KnowledgeRetrievalSegment = z.infer<typeof KnowledgeRetrievalSegmentSchema>;
export type KnowledgeNodeOutputData = z.infer<typeof KnowledgeNodeOutputDataSchema>;
export type ListKnowledgeBasesResponse = z.infer<typeof ListKnowledgeBasesResponseSchema>;
export type CreateKnowledgeBaseRequest = z.input<typeof CreateKnowledgeBaseRequestSchema>;
export type CreateKnowledgeBaseResponse = z.infer<typeof CreateKnowledgeBaseResponseSchema>;
export type GetKnowledgeBaseResponse = z.infer<typeof GetKnowledgeBaseResponseSchema>;
export type UpdateKnowledgeBaseRequest = z.input<typeof UpdateKnowledgeBaseRequestSchema>;
export type UpdateKnowledgeBaseResponse = z.infer<typeof UpdateKnowledgeBaseResponseSchema>;
export type ListKnowledgeDocumentsResponse = z.infer<typeof ListKnowledgeDocumentsResponseSchema>;
export type CreateTextKnowledgeDocumentRequest = z.input<typeof CreateTextKnowledgeDocumentRequestSchema>;
export type CreateFileKnowledgeDocumentRequest = z.input<typeof CreateFileKnowledgeDocumentRequestSchema>;
export type CreateKnowledgeDocumentResponse = z.infer<typeof CreateKnowledgeDocumentResponseSchema>;
export type ReindexKnowledgeDocumentResponse = z.infer<typeof ReindexKnowledgeDocumentResponseSchema>;

export type ApiIssue = z.infer<typeof ApiIssueSchema>;
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
export type WorkflowDto = z.infer<typeof WorkflowDtoSchema>;
export type WorkflowSummary = z.infer<typeof WorkflowSummarySchema>;
export type ListWorkflowsResponse = z.infer<typeof ListWorkflowsResponseSchema>;
export type CreateWorkflowRequest = z.input<typeof CreateWorkflowRequestSchema>;
export type CreateWorkflowResponse = z.infer<typeof CreateWorkflowResponseSchema>;
export type GetWorkflowResponse = z.infer<typeof GetWorkflowResponseSchema>;
export type UpdateWorkflowRequest = z.input<typeof UpdateWorkflowRequestSchema>;
export type UpdateWorkflowResponse = z.infer<typeof UpdateWorkflowResponseSchema>;
export type RunStatus = z.infer<typeof RunStatusSchema>;
export type RunInterrupt = z.infer<typeof RunInterruptSchema>;
export type HumanInputActionDto = z.infer<typeof HumanInputActionDtoSchema>;
export type ResumeRunRequest = z.input<typeof ResumeRunRequestSchema>;
export type ResumeRunResponse = z.infer<typeof ResumeRunResponseSchema>;
export type RunInput = z.infer<typeof RunInputSchema>;
export type CreateRunRequest = z.input<typeof CreateRunRequestSchema>;
export type WorkflowRunOutput = z.infer<typeof WorkflowRunOutputSchema>;
export type WorkflowRun = z.infer<typeof WorkflowRunSchema>;
export type CreateRunResponse = z.infer<typeof CreateRunResponseSchema>;
export type ListWorkflowRunsResponse = z.infer<typeof ListWorkflowRunsResponseSchema>;
export type GetRunResponse = z.infer<typeof GetRunResponseSchema>;
export type RunEventType = z.infer<typeof RunEventTypeSchema>;
export type RunEvent = z.infer<typeof RunEventSchema>;
export type ListRunEventsResponse = z.infer<typeof ListRunEventsResponseSchema>;
export type RunSseEvent = z.infer<typeof RunSseEventSchema>;

export function createApiErrorResponse(
  code: ApiErrorCode,
  message: string,
  issues?: ApiIssue[],
): ApiErrorResponse {
  return {
    error: {
      code,
      message,
      ...(issues && issues.length > 0 ? { issues } : {}),
    },
  };
}

export function zodIssuesToApiIssues(error: z.ZodError): ApiIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path,
    message: issue.message,
  }));
}
