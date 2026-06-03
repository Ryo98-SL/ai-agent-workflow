import {
  ApiErrorResponseSchema,
  API_ROUTE_TEMPLATES,
  CreateRunRequestSchema,
  CreateRunResponseSchema,
  CreateWorkflowRequestSchema,
  CreateWorkflowResponseSchema,
  GetRunResponseSchema,
  GetWorkflowResponseSchema,
  ListRunEventsResponseSchema,
  ListWorkflowsResponseSchema,
  UpdateWorkflowRequestSchema,
  UpdateWorkflowResponseSchema,
  apiPaths,
  createApiErrorResponse,
  zodIssuesToApiIssues,
  type RunEvent,
  type RunInput,
  type WorkflowDto,
  type WorkflowRun,
  type WorkflowSummary,
} from "@ai-agent-workflow/api-contracts";
import {
  createDefaultWorkflow,
  type OpenAICompatibleSettings,
  type WorkflowFile,
} from "@ai-agent-workflow/workflow-domain";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { z } from "zod";
import { logger } from "./logger";
import { executeWorkflowRuntime, type RuntimeExecutionResult } from "./runtime";

const SEED_TIME = "2026-06-01T00:00:00.000Z";

type StoredWorkflow = WorkflowDto;

type ServerState = {
  workflows: Map<string, StoredWorkflow>;
  runs: Map<string, WorkflowRun>;
  events: Map<string, RunEvent[]>;
  nextWorkflowNumber: number;
  nextRunNumber: number;
};

export type CreateServerAppOptions = {
  seedWorkflow?: WorkflowFile;
  fetch?: typeof fetch;
};

function cloneWorkflow(workflow: WorkflowFile): WorkflowFile {
  return JSON.parse(JSON.stringify(workflow)) as WorkflowFile;
}

function withFixedMetadata(workflow: WorkflowFile, name = workflow.metadata.name): WorkflowFile {
  return {
    ...cloneWorkflow(workflow),
    metadata: {
      ...workflow.metadata,
      name,
      createdAt: SEED_TIME,
      updatedAt: SEED_TIME,
    },
  };
}

function createState(options: CreateServerAppOptions = {}): ServerState {
  const seedWorkflow = withFixedMetadata(options.seedWorkflow ?? createDefaultWorkflow(), "Seed Workflow");
  const workflows = new Map<string, StoredWorkflow>([
    [
      "workflow-1",
      {
        id: "workflow-1",
        workflow: seedWorkflow,
      },
    ],
  ]);

  return {
    workflows,
    runs: new Map(),
    events: new Map(),
    nextWorkflowNumber: 2,
    nextRunNumber: 1,
  };
}

function workflowSummary(stored: StoredWorkflow): WorkflowSummary {
  return {
    id: stored.id,
    name: stored.workflow.metadata.name,
    description: stored.workflow.metadata.description,
    updatedAt: stored.workflow.metadata.updatedAt,
    nodeCount: stored.workflow.graph.nodes.length,
    edgeCount: stored.workflow.graph.edges.length,
  };
}

function workflowForRun(workflow: WorkflowFile, modelProvider?: OpenAICompatibleSettings): WorkflowFile {
  if (!modelProvider) {
    return workflow;
  }

  return {
    ...cloneWorkflow(workflow),
    settings: {
      ...workflow.settings,
      modelProvider,
    },
  };
}

async function readJsonBody(request: Request): Promise<unknown> {
  const raw = await request.text();
  if (raw.trim() === "") {
    return {};
  }

  return JSON.parse(raw);
}

async function parseJsonRequest<T>(
  request: Request,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
): Promise<{ ok: true; data: T } | { ok: false; status: 400; body: unknown }> {
  try {
    const payload = await readJsonBody(request);
    const result = schema.safeParse(payload);

    if (result.success) {
      return { ok: true, data: result.data };
    }

    return {
      ok: false,
      status: 400,
      body: createApiErrorResponse(
        "validation_error",
        "Request body did not match the API contract.",
        zodIssuesToApiIssues(result.error),
      ),
    };
  } catch (error) {
    logger.warn("request.json.invalid", {
      message: error instanceof Error ? error.message : "Invalid JSON body.",
    });
    return {
      ok: false,
      status: 400,
      body: createApiErrorResponse("bad_request", `Invalid JSON body: ${(error as Error).message}`),
    };
  }
}

function responseFromSchema<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, value: T): T {
  return schema.parse(value);
}

function secondAt(offset: number): string {
  const date = new Date(SEED_TIME);
  date.setUTCSeconds(date.getUTCSeconds() + offset);
  return date.toISOString();
}

function createEvent(
  runId: string,
  sequence: number,
  type: RunEvent["type"],
  message: string,
  createdAt: string,
  payload?: Record<string, unknown>,
): RunEvent {
  return {
    id: `${runId}-event-${sequence + 1}`,
    runId,
    sequence,
    type,
    message,
    createdAt,
    ...(payload ? { payload } : {}),
  };
}

function createRunFromExecution(
  state: ServerState,
  workflow: StoredWorkflow,
  input: RunInput,
  execution: RuntimeExecutionResult,
): WorkflowRun {
  const runNumber = state.nextRunNumber;
  state.nextRunNumber += 1;

  const runId = `run-${runNumber}`;
  const createdAt = secondAt(runNumber * 10);
  const startedAt = secondAt(runNumber * 10 + 1);
  const completedAt = secondAt(runNumber * 10 + execution.nodeResults.length + 2);
  const status = execution.ok ? "succeeded" : "failed";
  const run: WorkflowRun = {
    id: runId,
    workflowId: workflow.id,
    status,
    input,
    output: execution.ok
      ? {
          summary: `Workflow run completed for ${workflow.workflow.metadata.name}.`,
          nodeResults: execution.nodeResults,
        }
      : {
          summary: `Workflow run failed for ${workflow.workflow.metadata.name}.`,
          nodeResults: execution.nodeResults,
        },
    error: execution.ok ? null : execution.error,
    createdAt,
    startedAt,
    completedAt,
  };
  const events = [
    createEvent(runId, 0, "run.created", `Run ${runId} created.`, run.createdAt, { workflowId: workflow.id }),
    createEvent(runId, 1, "run.started", `Run ${runId} started.`, startedAt),
    ...execution.nodeResults.map((result, index) => ({
      ...createEvent(
        runId,
        index + 2,
        result.status === "failed" ? "node.failed" : "node.completed",
        `${result.label} ${result.status === "failed" ? "failed" : "completed"}.`,
        secondAt(runNumber * 10 + index + 2),
        { nodeId: result.nodeId, output: result.output, data: result.data },
      ),
    })),
    createEvent(
      runId,
      execution.nodeResults.length + 2,
      execution.ok ? "run.completed" : "run.failed",
      `Run ${runId} ${execution.ok ? "completed" : "failed"}.`,
      completedAt,
      { status: run.status },
    ),
  ];

  state.runs.set(runId, run);
  state.events.set(runId, events);
  return run;
}

function normalizedNotFound(message: string) {
  return responseFromSchema(ApiErrorResponseSchema, createApiErrorResponse("not_found", message));
}

export function createServerApp(options: CreateServerAppOptions = {}) {
  const state = createState(options);
  const app = new Hono();

  app.use("*", cors());

  app.get(apiPaths.workflows(), (c) => {
    const response = responseFromSchema(ListWorkflowsResponseSchema, {
      workflows: Array.from(state.workflows.values()).map(workflowSummary),
    });

    return c.json(response);
  });

  app.post(apiPaths.workflows(), async (c) => {
    const parsed = await parseJsonRequest(c.req.raw, CreateWorkflowRequestSchema);
    if (!parsed.ok) {
      return c.json(parsed.body, parsed.status);
    }

    const id = `workflow-${state.nextWorkflowNumber}`;
    state.nextWorkflowNumber += 1;
    const workflow = withFixedMetadata(parsed.data.workflow ?? createDefaultWorkflow());
    const stored: StoredWorkflow = { id, workflow };
    state.workflows.set(id, stored);
    const response = responseFromSchema(CreateWorkflowResponseSchema, { workflow: stored });
    logger.info("workflow.created", {
      workflowId: id,
      name: workflow.metadata.name,
      nodeCount: workflow.graph.nodes.length,
      edgeCount: workflow.graph.edges.length,
    });

    return c.json(response, 201);
  });

  app.get(API_ROUTE_TEMPLATES.workflow, (c) => {
    const id = c.req.param("id");
    const workflow = state.workflows.get(id);

    if (!workflow) {
      logger.warn("workflow.not_found", { workflowId: id, route: c.req.path });
      return c.json(normalizedNotFound(`Workflow ${id} was not found.`), 404);
    }

    return c.json(responseFromSchema(GetWorkflowResponseSchema, { workflow }));
  });

  app.put(API_ROUTE_TEMPLATES.workflow, async (c) => {
    const id = c.req.param("id");
    if (!state.workflows.has(id)) {
      return c.json(normalizedNotFound(`Workflow ${id} was not found.`), 404);
    }

    const parsed = await parseJsonRequest(c.req.raw, UpdateWorkflowRequestSchema);
    if (!parsed.ok) {
      return c.json(parsed.body, parsed.status);
    }

    const stored: StoredWorkflow = { id, workflow: cloneWorkflow(parsed.data.workflow) };
    state.workflows.set(id, stored);
    logger.info("workflow.updated", {
      workflowId: id,
      name: stored.workflow.metadata.name,
      nodeCount: stored.workflow.graph.nodes.length,
      edgeCount: stored.workflow.graph.edges.length,
    });

    return c.json(responseFromSchema(UpdateWorkflowResponseSchema, { workflow: stored }));
  });

  app.post(API_ROUTE_TEMPLATES.workflowRuns, async (c) => {
    const workflowId = c.req.param("id");
    const workflow = state.workflows.get(workflowId);

    if (!workflow) {
      logger.warn("workflow.not_found", { workflowId, route: c.req.path });
      return c.json(normalizedNotFound(`Workflow ${workflowId} was not found.`), 404);
    }

    const parsed = await parseJsonRequest(c.req.raw, CreateRunRequestSchema);
    if (!parsed.ok) {
      return c.json(parsed.body, parsed.status);
    }

    logger.info("run.create_requested", {
      workflowId,
      inputKeys: Object.keys(parsed.data.input),
      hasTransientModelProvider: Boolean(parsed.data.modelProvider),
    });
    const execution = await executeWorkflowRuntime(
      workflowForRun(workflow.workflow, parsed.data.modelProvider),
      parsed.data.input,
      {
        fetch: options.fetch,
      },
    );
    const run = createRunFromExecution(state, workflow, parsed.data.input, execution);
    logger.info("run.created", {
      runId: run.id,
      workflowId,
      status: run.status,
      nodeResultCount: execution.nodeResults.length,
      errorCode: execution.ok ? null : execution.error.code,
    });

    return c.json(responseFromSchema(CreateRunResponseSchema, { run }), 201);
  });

  app.get(API_ROUTE_TEMPLATES.run, (c) => {
    const id = c.req.param("id");
    const run = state.runs.get(id);

    if (!run) {
      logger.warn("run.not_found", { runId: id, route: c.req.path });
      return c.json(normalizedNotFound(`Run ${id} was not found.`), 404);
    }

    return c.json(responseFromSchema(GetRunResponseSchema, { run }));
  });

  app.get(API_ROUTE_TEMPLATES.runEvents, (c) => {
    const id = c.req.param("id");
    const events = state.events.get(id);

    if (!events) {
      logger.warn("run.not_found", { runId: id, route: c.req.path });
      return c.json(normalizedNotFound(`Run ${id} was not found.`), 404);
    }

    return c.json(responseFromSchema(ListRunEventsResponseSchema, { events }));
  });

  app.notFound((c) => c.json(normalizedNotFound(`Route ${c.req.path} was not found.`), 404));

  app.onError((error, c) => {
    const body = createApiErrorResponse("internal_error", error.message);
    logger.error("server.internal_error", {
      route: c.req.path,
      message: error.message,
    });

    return c.json(responseFromSchema(ApiErrorResponseSchema, body), 500);
  });

  return app;
}
