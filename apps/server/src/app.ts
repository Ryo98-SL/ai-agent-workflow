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
  type RunSseEvent,
  type WorkflowDto,
  type WorkflowRun,
  type WorkflowSummary,
} from "@ai-agent-workflow/api-contracts";
import {
  createDefaultWorkflow,
  type ModelProviderKeys,
  type OpenAICompatibleSettings,
  type WorkflowFile,
} from "@ai-agent-workflow/workflow-domain";
import { MemorySaver, type BaseCheckpointSaver } from "@langchain/langgraph";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { z } from "zod";
import { logger } from "./logger";
import { executeWorkflowRuntime, type RuntimeExecutionResult } from "./runtime";

const SEED_TIME = "2026-06-01T00:00:00.000Z";

type StoredWorkflow = WorkflowDto;

type RunStreamBuffer = {
  events: RunSseEvent[];
  done: boolean;
  listeners: Set<(event: RunSseEvent) => void>;
};

type ServerState = {
  workflows: Map<string, StoredWorkflow>;
  runs: Map<string, WorkflowRun>;
  events: Map<string, RunEvent[]>;
  streamBuffers: Map<string, RunStreamBuffer>;
  checkpointer: BaseCheckpointSaver;
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
    streamBuffers: new Map(),
    checkpointer: new MemorySaver(),
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

function workflowForRun(
  workflow: WorkflowFile,
  modelProvider?: OpenAICompatibleSettings,
  modelProviderKeys?: ModelProviderKeys,
): WorkflowFile {
  if (!modelProvider && !modelProviderKeys) {
    return workflow;
  }

  return {
    ...cloneWorkflow(workflow),
    settings: {
      ...workflow.settings,
      modelProvider: modelProvider || workflow.settings.modelProvider,
      modelProviderKeys: {
        ...workflow.settings.modelProviderKeys,
        ...modelProviderKeys,
      },
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
      { status: run.status, streamEventCount: execution.streamEvents.length },
    ),
  ];

  state.runs.set(runId, run);
  state.events.set(runId, events);
  return run;
}

function pushToBuffer(buffer: RunStreamBuffer, event: RunSseEvent) {
  buffer.events.push(event);
  for (const listener of buffer.listeners) {
    listener(event);
  }
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

    const runNumber = state.nextRunNumber;
    state.nextRunNumber += 1;
    const runId = `run-${runNumber}`;
    const createdAt = secondAt(runNumber * 10);
    const startedAt = secondAt(runNumber * 10 + 1);

    const pendingRun: WorkflowRun = {
      id: runId,
      workflowId: workflow.id,
      status: "running",
      input: parsed.data.input,
      output: null,
      error: null,
      createdAt,
      startedAt,
      completedAt: null,
    };
    state.runs.set(runId, pendingRun);
    state.events.set(runId, [
      createEvent(runId, 0, "run.created", `Run ${runId} created.`, createdAt, { workflowId: workflow.id }),
      createEvent(runId, 1, "run.started", `Run ${runId} started.`, startedAt),
    ]);

    const buffer: RunStreamBuffer = { events: [], done: false, listeners: new Set() };
    state.streamBuffers.set(runId, buffer);
    pushToBuffer(buffer, { type: "run.started", runId });

    logger.info("run.create_requested", {
      runId,
      workflowId,
      inputKeys: Object.keys(parsed.data.input),
      hasTransientModelProvider: Boolean(parsed.data.modelProvider),
      hasTransientModelProviderKeys: Boolean(parsed.data.modelProviderKeys),
    });

    const nodeOutputs = new Map<string, { output: string; data?: Record<string, unknown>; inputTokens?: number; outputTokens?: number }>();

    void executeWorkflowRuntime(
      workflowForRun(workflow.workflow, parsed.data.modelProvider, parsed.data.modelProviderKeys),
      parsed.data.input,
      {
        checkpointer: state.checkpointer,
        fetch: options.fetch,
        threadId: runId,
        onStreamEvent: (event) => {
          const buf = state.streamBuffers.get(runId);
          if (!buf) return;

          if (event.type === "node.started" && event.nodeId && event.nodeType) {
            pushToBuffer(buf, {
              type: "node.started",
              runId,
              nodeId: event.nodeId,
              nodeType: event.nodeType as RunSseEvent extends { type: "node.started"; nodeType: infer T } ? T : never,
            });
          } else if (event.type === "node.stream" && event.nodeId && event.message) {
            pushToBuffer(buf, { type: "node.stream", runId, nodeId: event.nodeId, delta: event.message });
          } else if (event.type === "node.completed" && event.nodeId && event.nodeType) {
            const stored = nodeOutputs.get(event.nodeId);
            pushToBuffer(buf, {
              type: "node.completed",
              runId,
              nodeId: event.nodeId,
              nodeType: event.nodeType as RunSseEvent extends { type: "node.completed"; nodeType: infer T } ? T : never,
              output: event.output ?? stored?.output ?? "",
              data: event.data ?? stored?.data,
              durationMs: event.durationMs ?? 0,
              inputTokens: stored?.inputTokens,
              outputTokens: stored?.outputTokens,
            });
          } else if (event.type === "node.failed" && event.nodeId && event.nodeType) {
            pushToBuffer(buf, {
              type: "node.failed",
              runId,
              nodeId: event.nodeId,
              nodeType: event.nodeType as RunSseEvent extends { type: "node.failed"; nodeType: infer T } ? T : never,
              error: "Node execution failed.",
              durationMs: event.durationMs ?? 0,
            });
          } else if (event.type === "node.tokens" && event.nodeId && event.tokenUsage) {
            const existing = nodeOutputs.get(event.nodeId) ?? { output: "" };
            nodeOutputs.set(event.nodeId, { ...existing, ...event.tokenUsage });
          }
        },
      },
    ).then((execution) => {
      for (const result of execution.nodeResults) {
        const existing = nodeOutputs.get(result.nodeId) ?? {};
        nodeOutputs.set(result.nodeId, { ...existing, output: result.output, data: result.data });
      }

      const completedAt = secondAt(runNumber * 10 + execution.nodeResults.length + 2);
      const status = execution.ok ? "succeeded" : "failed";
      const finalRun: WorkflowRun = {
        ...pendingRun,
        status,
        output: {
          summary: execution.ok
            ? `Workflow run completed for ${workflow.workflow.metadata.name}.`
            : `Workflow run failed for ${workflow.workflow.metadata.name}.`,
          nodeResults: execution.nodeResults,
        },
        error: execution.ok ? null : execution.error,
        completedAt,
      };
      state.runs.set(runId, finalRun);

      const existingEvents = state.events.get(runId) ?? [];
      const nodeEvents = execution.nodeResults.map((result, index) =>
        createEvent(
          runId,
          index + 2,
          result.status === "failed" ? "node.failed" : "node.completed",
          `${result.label} ${result.status === "failed" ? "failed" : "completed"}.`,
          secondAt(runNumber * 10 + index + 2),
          { nodeId: result.nodeId, output: result.output, data: result.data },
        ),
      );
      const completionEvent = createEvent(
        runId,
        execution.nodeResults.length + 2,
        execution.ok ? "run.completed" : "run.failed",
        `Run ${runId} ${execution.ok ? "completed" : "failed"}.`,
        completedAt,
        { status, streamEventCount: execution.streamEvents.length },
      );
      state.events.set(runId, [...existingEvents, ...nodeEvents, completionEvent]);

      const buf = state.streamBuffers.get(runId);
      if (buf) {
        pushToBuffer(buf, { type: "run.completed", runId, status: status === "succeeded" ? "succeeded" : "failed" });
        buf.done = true;
        buf.listeners.clear();
        setTimeout(() => state.streamBuffers.delete(runId), 30_000);
      }

      logger.info("run.created", {
        runId,
        workflowId,
        status,
        nodeResultCount: execution.nodeResults.length,
        errorCode: execution.ok ? null : execution.error.code,
      });
    }).catch((error) => {
      const buf = state.streamBuffers.get(runId);
      const message = error instanceof Error ? error.message : "Execution failed.";
      if (buf) {
        pushToBuffer(buf, { type: "run.completed", runId, status: "failed" });
        buf.done = true;
        buf.listeners.clear();
        setTimeout(() => state.streamBuffers.delete(runId), 30_000);
      }
      logger.error("run.execution_error", { runId, message });
    });

    return c.json(responseFromSchema(CreateRunResponseSchema, { run: pendingRun }), 201);
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

  app.get(API_ROUTE_TEMPLATES.runStream, (c) => {
    const id = c.req.param("id");
    const run = state.runs.get(id);

    if (!run) {
      logger.warn("run.not_found", { runId: id, route: c.req.path });
      return c.json(normalizedNotFound(`Run ${id} was not found.`), 404);
    }

    const buffer = state.streamBuffers.get(id);

    c.header("Content-Type", "text/event-stream");
    c.header("Cache-Control", "no-cache");
    c.header("Connection", "keep-alive");

    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    const sendEvent = (event: RunSseEvent) => {
      const data = `data: ${JSON.stringify(event)}\n\n`;
      writer.write(encoder.encode(data)).catch(() => {});
    };

    const closeStream = () => {
      writer.close().catch(() => {});
    };

    if (!buffer) {
      // Run completed, replay from snapshot events
      const snapshotEvents = state.events.get(id) ?? [];
      const isCompleted = run.status === "succeeded" || run.status === "failed";
      if (isCompleted) {
        (async () => {
          sendEvent({ type: "run.started", runId: id });
          for (const snapEvent of snapshotEvents) {
            if (snapEvent.type === "node.completed" || snapEvent.type === "node.failed") {
              const payload = snapEvent.payload ?? {};
              const nodeId = typeof payload.nodeId === "string" ? payload.nodeId : "";
              const node = run.output?.nodeResults.find((r) => r.nodeId === nodeId);
              if (snapEvent.type === "node.completed" && node) {
                const workflowNode = state.workflows.get(run.workflowId)?.workflow.graph.nodes.find((n) => n.id === nodeId);
                if (workflowNode) {
                  sendEvent({
                    type: "node.completed",
                    runId: id,
                    nodeId,
                    nodeType: workflowNode.type as RunSseEvent extends { type: "node.completed"; nodeType: infer T } ? T : never,
                    output: node.output,
                    durationMs: 0,
                  });
                }
              }
            }
          }
          sendEvent({ type: "run.completed", runId: id, status: run.status === "succeeded" ? "succeeded" : "failed" });
          closeStream();
        })().catch(() => {});
      } else {
        closeStream();
      }
      return new Response(readable as unknown as ReadableStream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
    }

    // Stream in-progress run
    for (const event of buffer.events) {
      sendEvent(event);
    }

    if (buffer.done) {
      closeStream();
    } else {
      const listener = (event: RunSseEvent) => {
        sendEvent(event);
        if (event.type === "run.completed") {
          buffer.listeners.delete(listener);
          closeStream();
        }
      };
      buffer.listeners.add(listener);

      c.req.raw.signal.addEventListener("abort", () => {
        buffer.listeners.delete(listener);
        closeStream();
      });
    }

    return new Response(readable as unknown as ReadableStream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
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
