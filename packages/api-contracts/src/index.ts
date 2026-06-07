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
  providerKeys: "/api/provider-keys",
  providerKeyById: "/api/provider-keys/:id",
  customModels: "/api/custom-models",
  customModel: "/api/custom-models/:id",
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
  providerKeys: () => API_ROUTE_TEMPLATES.providerKeys,
  providerKeyById: (id: string) => `/api/provider-keys/${encodePathSegment(id)}`,
  customModels: () => API_ROUTE_TEMPLATES.customModels,
  customModel: (id: string) => `/api/custom-models/${encodePathSegment(id)}`,
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

export const RunStatusSchema = z.enum(["queued", "running", "succeeded", "failed"]);
export const RunInputValueSchema = z.union([z.string(), z.null()]);
export const RunInputSchema = z.record(RunInputValueSchema);

export const CreateRunRequestSchema = z.object({
  input: RunInputSchema.default({}),
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
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
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
]);

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
