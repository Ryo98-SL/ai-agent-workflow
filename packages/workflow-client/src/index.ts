import {
  ApiErrorResponseSchema,
  CreateCustomModelResponseSchema,
  CreateRunResponseSchema,
  CreateWorkflowResponseSchema,
  GetRunResponseSchema,
  GetWorkflowResponseSchema,
  ListCustomModelsResponseSchema,
  ListProviderKeysResponseSchema,
  ListRunEventsResponseSchema,
  ListWorkflowRunsResponseSchema,
  ListWorkflowsResponseSchema,
  PutProviderKeyResponseSchema,
  UpdateWorkflowResponseSchema,
  apiPaths,
  type ApiErrorResponse,
  type CreateCustomModelRequest,
  type CreateCustomModelResponse,
  type CreateRunRequest,
  type CreateRunResponse,
  type CreateWorkflowRequest,
  type CreateWorkflowResponse,
  type GetRunResponse,
  type GetWorkflowResponse,
  type ListCustomModelsResponse,
  type ListProviderKeysResponse,
  type ListRunEventsResponse,
  type ListWorkflowRunsResponse,
  type ListWorkflowsResponse,
  type PutProviderKeyRequest,
  type PutProviderKeyResponse,
  type UpdateWorkflowRequest,
  type UpdateWorkflowResponse,
} from "@ai-agent-workflow/api-contracts";
import type { z } from "zod";

export type WorkflowClientErrorKind = "network" | "http" | "schema";

export type WorkflowClientErrorOptions = {
  kind: WorkflowClientErrorKind;
  message: string;
  status?: number;
  apiError?: ApiErrorResponse;
  cause?: unknown;
};

export class WorkflowClientError extends Error {
  readonly kind: WorkflowClientErrorKind;
  readonly status?: number;
  readonly apiError?: ApiErrorResponse;
  override readonly cause?: unknown;

  constructor(options: WorkflowClientErrorOptions) {
    super(options.message);
    this.name = "WorkflowClientError";
    this.kind = options.kind;
    this.status = options.status;
    this.apiError = options.apiError;
    this.cause = options.cause;
  }
}

export type WorkflowClientOptions = {
  baseUrl: string;
  fetch?: typeof fetch;
};

export type WorkflowClient = {
  listWorkflows: () => Promise<ListWorkflowsResponse>;
  createWorkflow: (request?: CreateWorkflowRequest) => Promise<CreateWorkflowResponse>;
  getWorkflow: (id: string) => Promise<GetWorkflowResponse>;
  updateWorkflow: (id: string, request: UpdateWorkflowRequest) => Promise<UpdateWorkflowResponse>;
  deleteWorkflow: (id: string) => Promise<void>;
  createRun: (workflowId: string, request?: CreateRunRequest) => Promise<CreateRunResponse>;
  listWorkflowRuns: (workflowId: string) => Promise<ListWorkflowRunsResponse>;
  getRun: (id: string) => Promise<GetRunResponse>;
  listRunEvents: (id: string) => Promise<ListRunEventsResponse>;
  runStreamUrl: (id: string) => string;
  listProviderKeys: () => Promise<ListProviderKeysResponse>;
  putProviderKey: (provider: string, request: PutProviderKeyRequest) => Promise<PutProviderKeyResponse>;
  deleteProviderKey: (provider: string) => Promise<void>;
  listCustomModels: () => Promise<ListCustomModelsResponse>;
  createCustomModel: (request: CreateCustomModelRequest) => Promise<CreateCustomModelResponse>;
  deleteCustomModel: (id: string) => Promise<void>;
};

type RequestOptions<TResponse> = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  body?: unknown;
  responseSchema?: z.ZodType<TResponse, z.ZodTypeDef, unknown>;
};

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.trim() === "") {
    return undefined;
  }

  return JSON.parse(text);
}

function schemaError(message: string, cause: unknown): WorkflowClientError {
  return new WorkflowClientError({
    kind: "schema",
    message,
    cause,
  });
}

export function createWorkflowClient(options: WorkflowClientOptions): WorkflowClient {
  const fetchImpl = options.fetch ?? globalThis.fetch;

  if (!fetchImpl) {
    throw new WorkflowClientError({
      kind: "network",
      message: "No fetch implementation is available.",
    });
  }

  async function request<TResponse>(requestOptions: RequestOptions<TResponse>): Promise<TResponse> {
    let response: Response;

    try {
      response = await fetchImpl(joinUrl(options.baseUrl, requestOptions.path), {
        method: requestOptions.method ?? "GET",
        // Cross-origin cookie auth (Better Auth session under shared parent domain).
        credentials: "include",
        headers:
          requestOptions.body === undefined
            ? undefined
            : {
                "content-type": "application/json",
              },
        body: requestOptions.body === undefined ? undefined : JSON.stringify(requestOptions.body),
      });
    } catch (error) {
      throw new WorkflowClientError({
        kind: "network",
        message: `Network request failed: ${(error as Error).message}`,
        cause: error,
      });
    }

    let payload: unknown;
    try {
      payload = await readJson(response);
    } catch (error) {
      throw schemaError("Response body was not valid JSON.", error);
    }

    if (!response.ok) {
      const parsedError = ApiErrorResponseSchema.safeParse(payload);
      const apiError = parsedError.success
        ? parsedError.data
        : {
            error: {
              code: "internal_error" as const,
              message: `HTTP ${response.status} ${response.statusText || "error"}`,
            },
          };

      throw new WorkflowClientError({
        kind: "http",
        status: response.status,
        apiError,
        message: apiError.error.message,
      });
    }

    if (!requestOptions.responseSchema) {
      return undefined as TResponse;
    }

    const parsed = requestOptions.responseSchema.safeParse(payload);
    if (!parsed.success) {
      throw schemaError("Response body did not match the API contract.", parsed.error);
    }

    return parsed.data;
  }

  return {
    listWorkflows: () =>
      request({
        path: apiPaths.workflows(),
        responseSchema: ListWorkflowsResponseSchema,
      }),
    createWorkflow: (body = {}) =>
      request({
        method: "POST",
        path: apiPaths.workflows(),
        body,
        responseSchema: CreateWorkflowResponseSchema,
      }),
    getWorkflow: (id) =>
      request({
        path: apiPaths.workflow(id),
        responseSchema: GetWorkflowResponseSchema,
      }),
    updateWorkflow: (id, body) =>
      request({
        method: "PUT",
        path: apiPaths.workflow(id),
        body,
        responseSchema: UpdateWorkflowResponseSchema,
      }),
    deleteWorkflow: (id) =>
      request<void>({
        method: "DELETE",
        path: apiPaths.workflow(id),
      }),
    createRun: (workflowId, body = { input: {} }) =>
      request({
        method: "POST",
        path: apiPaths.workflowRuns(workflowId),
        body,
        responseSchema: CreateRunResponseSchema,
      }),
    listWorkflowRuns: (workflowId) =>
      request({
        path: apiPaths.workflowRuns(workflowId),
        responseSchema: ListWorkflowRunsResponseSchema,
      }),
    getRun: (id) =>
      request({
        path: apiPaths.run(id),
        responseSchema: GetRunResponseSchema,
      }),
    listRunEvents: (id) =>
      request({
        path: apiPaths.runEvents(id),
        responseSchema: ListRunEventsResponseSchema,
      }),
    runStreamUrl: (id) => joinUrl(options.baseUrl, apiPaths.runStream(id)),
    listProviderKeys: () =>
      request({
        path: apiPaths.providerKeys(),
        responseSchema: ListProviderKeysResponseSchema,
      }),
    putProviderKey: (provider, body) =>
      request({
        method: "PUT",
        path: apiPaths.providerKey(provider),
        body,
        responseSchema: PutProviderKeyResponseSchema,
      }),
    deleteProviderKey: (provider) =>
      request<void>({
        method: "DELETE",
        path: apiPaths.providerKey(provider),
      }),
    listCustomModels: () =>
      request({
        path: apiPaths.customModels(),
        responseSchema: ListCustomModelsResponseSchema,
      }),
    createCustomModel: (body) =>
      request({
        method: "POST",
        path: apiPaths.customModels(),
        body,
        responseSchema: CreateCustomModelResponseSchema,
      }),
    deleteCustomModel: (id) =>
      request<void>({
        method: "DELETE",
        path: apiPaths.customModel(id),
      }),
  };
}
