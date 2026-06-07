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
  ListWorkflowRunsResponseSchema,
  ListWorkflowsResponseSchema,
  UpdateWorkflowRequestSchema,
  UpdateWorkflowResponseSchema,
  apiPaths,
  createApiErrorResponse,
  zodIssuesToApiIssues,
  type RunEvent,
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
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import type { z } from "zod";
import { auth } from "./auth/auth";
import { resolveUserId } from "./auth/middleware";
import { logger } from "./logger";
import { createAccountRoutes, loadDecryptedProviderKey, loadDecryptedProviderKeyById } from "./routes/account";
import { consumeCredits, createCreditRoutes, loadCreditBalance } from "./routes/credits";
import { executeWorkflowRuntime } from "./runtime";
import { frontendOrigins } from "./config";
import { createPrismaWorkflowRepository, type WorkflowRepository } from "./workflows/repository";
import { createPrismaRunRepository, type RunRepository } from "./runs/repository";
import { randomUUID } from "node:crypto";

// How long a completed run lingers in memory before eviction (authed runs are
// durable in Postgres; anonymous runs are gone after this).
const RUN_MEMORY_TTL_MS = 10 * 60 * 1000;

type RunStreamBuffer = {
  events: RunSseEvent[];
  done: boolean;
  listeners: Set<(event: RunSseEvent) => void>;
};

type ServerState = {
  // Live + recently-completed runs, source for SSE and immediate reads. Authed
  // runs are also persisted to Postgres; anonymous runs live only here.
  runs: Map<string, WorkflowRun>;
  events: Map<string, RunEvent[]>;
  streamBuffers: Map<string, RunStreamBuffer>;
  // Effective workflow used for each run, kept for SSE replay; keyed by runId.
  runWorkflows: Map<string, WorkflowFile>;
  runOwners: Map<string, string | null>;
  checkpointer: BaseCheckpointSaver;
};

export type CreateServerAppOptions = {
  fetch?: typeof fetch;
  /** Workflow persistence. Defaults to the Prisma-backed repository. */
  workflows?: WorkflowRepository;
  /** Run persistence (authed runs). Defaults to the Prisma-backed repository. */
  runs?: RunRepository;
  /** Durable LangGraph checkpointer for authed runs. Anonymous runs use MemorySaver. */
  authedCheckpointer?: BaseCheckpointSaver;
  /** Resolves the session userId. Defaults to the Better Auth resolver. */
  resolveUserId?: (c: Context) => Promise<string | null>;
};

function cloneWorkflow(workflow: WorkflowFile): WorkflowFile {
  return JSON.parse(JSON.stringify(workflow)) as WorkflowFile;
}

function createState(): ServerState {
  return {
    runs: new Map(),
    events: new Map(),
    streamBuffers: new Map(),
    runWorkflows: new Map(),
    runOwners: new Map(),
    checkpointer: new MemorySaver(),
  };
}

function workflowSummary(stored: WorkflowDto): WorkflowSummary {
  return {
    id: stored.id,
    name: stored.workflow.metadata.name,
    description: stored.workflow.metadata.description,
    icon: stored.workflow.metadata.icon,
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

function pushToBuffer(buffer: RunStreamBuffer, event: RunSseEvent) {
  buffer.events.push(event);
  for (const listener of buffer.listeners) {
    listener(event);
  }
}

function normalizedNotFound(message: string) {
  return responseFromSchema(ApiErrorResponseSchema, createApiErrorResponse("not_found", message));
}

function normalizedUnauthorized() {
  return responseFromSchema(
    ApiErrorResponseSchema,
    createApiErrorResponse("unauthorized", "Authentication is required for this resource."),
  );
}

export function createServerApp(options: CreateServerAppOptions = {}) {
  const state = createState();
  const workflows = options.workflows ?? createPrismaWorkflowRepository();
  const runRepo = options.runs ?? createPrismaRunRepository();
  const resolveUser = options.resolveUserId ?? resolveUserId;
  const app = new Hono();

  function evictRunFromMemory(runId: string) {
    setTimeout(() => {
      state.runs.delete(runId);
      state.events.delete(runId);
      state.runWorkflows.delete(runId);
      state.runOwners.delete(runId);
      state.streamBuffers.delete(runId);
    }, RUN_MEMORY_TTL_MS);
  }

  // Credentialed CORS locked to the frontend origin so the Better Auth session
  // cookie can be sent cross-origin (shared parent domain in production).
  app.use(
    "*",
    cors({
      origin: frontendOrigins,
      credentials: true,
      allowHeaders: ["Content-Type", "Authorization"],
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    }),
  );

  // Better Auth handles /api/auth/* (sign-in, sign-up, OAuth callbacks, session).
  app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

  // User-private account resources (provider keys, custom models).
  app.route("/", createAccountRoutes());
  // AI credits: status + one-time auto-approved application.
  app.route("/", createCreditRoutes());

  app.get(apiPaths.workflows(), async (c) => {
    const userId = await resolveUser(c);
    if (!userId) {
      return c.json(normalizedUnauthorized(), 401);
    }

    const list = await workflows.list(userId);
    return c.json(
      responseFromSchema(ListWorkflowsResponseSchema, {
        workflows: list.map(workflowSummary),
      }),
    );
  });

  app.post(apiPaths.workflows(), async (c) => {
    const userId = await resolveUser(c);
    if (!userId) {
      return c.json(normalizedUnauthorized(), 401);
    }

    const parsed = await parseJsonRequest(c.req.raw, CreateWorkflowRequestSchema);
    if (!parsed.ok) {
      return c.json(parsed.body, parsed.status);
    }

    const created = await workflows.create(userId, parsed.data.workflow ?? createDefaultWorkflow());
    logger.info("workflow.created", {
      workflowId: created.id,
      name: created.workflow.metadata.name,
      nodeCount: created.workflow.graph.nodes.length,
      edgeCount: created.workflow.graph.edges.length,
    });

    return c.json(responseFromSchema(CreateWorkflowResponseSchema, { workflow: created }), 201);
  });

  app.get(API_ROUTE_TEMPLATES.workflow, async (c) => {
    const userId = await resolveUser(c);
    if (!userId) {
      return c.json(normalizedUnauthorized(), 401);
    }

    const id = c.req.param("id");
    const workflow = await workflows.get(userId, id);
    if (!workflow) {
      logger.warn("workflow.not_found", { workflowId: id, route: c.req.path });
      return c.json(normalizedNotFound(`Workflow ${id} was not found.`), 404);
    }

    return c.json(responseFromSchema(GetWorkflowResponseSchema, { workflow }));
  });

  app.put(API_ROUTE_TEMPLATES.workflow, async (c) => {
    const userId = await resolveUser(c);
    if (!userId) {
      return c.json(normalizedUnauthorized(), 401);
    }

    const id = c.req.param("id");
    const parsed = await parseJsonRequest(c.req.raw, UpdateWorkflowRequestSchema);
    if (!parsed.ok) {
      return c.json(parsed.body, parsed.status);
    }

    const updated = await workflows.update(userId, id, parsed.data.workflow);
    if (!updated) {
      return c.json(normalizedNotFound(`Workflow ${id} was not found.`), 404);
    }

    logger.info("workflow.updated", {
      workflowId: updated.id,
      name: updated.workflow.metadata.name,
      nodeCount: updated.workflow.graph.nodes.length,
      edgeCount: updated.workflow.graph.edges.length,
    });

    return c.json(responseFromSchema(UpdateWorkflowResponseSchema, { workflow: updated }));
  });

  app.delete(API_ROUTE_TEMPLATES.workflow, async (c) => {
    const userId = await resolveUser(c);
    if (!userId) {
      return c.json(normalizedUnauthorized(), 401);
    }

    const id = c.req.param("id");
    const deleted = await workflows.delete(userId, id);
    if (!deleted) {
      return c.json(normalizedNotFound(`Workflow ${id} was not found.`), 404);
    }

    logger.info("workflow.deleted", { workflowId: id });
    return c.body(null, 204);
  });

  app.post(API_ROUTE_TEMPLATES.workflowRuns, async (c) => {
    const workflowId = c.req.param("id");

    const parsed = await parseJsonRequest(c.req.raw, CreateRunRequestSchema);
    if (!parsed.ok) {
      return c.json(parsed.body, parsed.status);
    }

    const userId = await resolveUser(c);

    // Resolve the workflow to execute: an inline definition (anonymous/unsaved
    // runs) wins; otherwise look it up by id for the authenticated user.
    let runWorkflow = parsed.data.workflow ?? null;
    // The stored-workflow row id, used as the run's FK. Null for inline runs.
    let runWorkflowRowId: string | null = null;
    if (!runWorkflow && userId) {
      const stored = await workflows.get(userId, workflowId);
      runWorkflow = stored?.workflow ?? null;
      runWorkflowRowId = stored ? workflowId : null;
    }
    if (!runWorkflow) {
      logger.warn("workflow.not_found", { workflowId, route: c.req.path });
      return c.json(normalizedNotFound(`Workflow ${workflowId} was not found.`), 404);
    }

    // Inject the authenticated user's stored provider key when the request did
    // not supply a transient one for the run's provider. The plaintext key is
    // decrypted here just-in-time and never leaves the server.
    //
    // Usage priority gates this: when the provider is explicitly set to "credits"
    // we skip key injection (the credits path is owned by a later phase). For
    // "apiKey" — or legacy runs with no saved preference — we resolve a key by:
    // the request's providerKeyId override → the saved providerKeyPrefs
    // selection → the most recent stored key (back-compat).
    let effectiveProviderKeys = parsed.data.modelProviderKeys;
    const runProvider = parsed.data.modelProvider?.provider ?? runWorkflow.settings.modelProvider?.provider;
    const savedPref = runProvider ? runWorkflow.settings.providerKeyPrefs?.[runProvider] : undefined;
    const usesCredits = savedPref?.usagePriority === "credits" && !parsed.data.providerKeyId;
    if (runProvider && runProvider !== "ollama" && !effectiveProviderKeys?.[runProvider] && userId && !usesCredits) {
      const selectedKeyId = parsed.data.providerKeyId ?? savedPref?.providerKeyId;
      const storedKey = selectedKeyId
        ? await loadDecryptedProviderKeyById(userId, selectedKeyId)
        : await loadDecryptedProviderKey(userId, runProvider);
      if (storedKey) {
        effectiveProviderKeys = { ...effectiveProviderKeys, [runProvider]: storedKey };
      }
    }

    // Credits path: when a paid provider runs on AI credits (no key resolved),
    // require an approved grant with a positive balance and meter the run.
    let creditBudget: number | undefined;
    const needsCredits =
      Boolean(runProvider) && runProvider !== "ollama" && usesCredits && !effectiveProviderKeys?.[runProvider!];
    if (needsCredits) {
      if (!userId) {
        return c.json(
          createApiErrorResponse(
            "credits_required",
            "Sign in and apply for AI credits, or add an API key for this provider.",
          ),
          402,
        );
      }
      const balance = await loadCreditBalance(userId);
      if (balance == null) {
        return c.json(
          createApiErrorResponse("credits_required", "Apply for AI credits or add an API key for this provider."),
          402,
        );
      }
      if (balance <= 0) {
        return c.json(
          createApiErrorResponse("credits_exhausted", "AI credits exhausted. Apply for more or add an API key."),
          402,
        );
      }
      creditBudget = balance;
    }

    const runId = randomUUID();
    state.runWorkflows.set(runId, runWorkflow);
    const createdAt = new Date().toISOString();
    const startedAt = new Date().toISOString();

    const pendingRun: WorkflowRun = {
      id: runId,
      workflowId,
      status: "running",
      input: parsed.data.input,
      output: null,
      error: null,
      createdAt,
      startedAt,
      completedAt: null,
    };
    state.runs.set(runId, pendingRun);
    state.runOwners.set(runId, userId);
    state.events.set(runId, [
      createEvent(runId, 0, "run.created", `Run ${runId} created.`, createdAt, { workflowId }),
      createEvent(runId, 1, "run.started", `Run ${runId} started.`, startedAt),
    ]);

    // Persist authed runs (durable history). Failures must not break the run.
    if (userId) {
      try {
        await runRepo.create(userId, pendingRun, runWorkflowRowId);
      } catch (error) {
        logger.error("run.persist_create_failed", {
          runId,
          message: error instanceof Error ? error.message : "persist failed",
        });
      }
    }

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

    // Authed runs use the durable Postgres checkpointer (when available);
    // anonymous runs use the ephemeral in-memory MemorySaver.
    const checkpointer = userId && options.authedCheckpointer ? options.authedCheckpointer : state.checkpointer;

    void executeWorkflowRuntime(
      workflowForRun(runWorkflow, parsed.data.modelProvider, effectiveProviderKeys),
      parsed.data.input,
      {
        checkpointer,
        fetch: options.fetch,
        threadId: runId,
        creditBudget,
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
              error: event.message ?? "Node execution failed.",
              durationMs: event.durationMs ?? 0,
            });
          } else if (event.type === "node.tokens" && event.nodeId && event.tokenUsage) {
            const existing = nodeOutputs.get(event.nodeId) ?? { output: "" };
            nodeOutputs.set(event.nodeId, { ...existing, ...event.tokenUsage });
          }
        },
      },
    ).then(async (execution) => {
      // Deduct metered tokens from the credit balance (credits runs only).
      if (creditBudget != null && userId && execution.consumedTokens > 0) {
        try {
          await consumeCredits(userId, execution.consumedTokens);
        } catch (error) {
          logger.error("credits.consume_failed", {
            runId,
            message: error instanceof Error ? error.message : "consume failed",
          });
        }
      }

      for (const result of execution.nodeResults) {
        const existing = nodeOutputs.get(result.nodeId) ?? {};
        nodeOutputs.set(result.nodeId, { ...existing, output: result.output, data: result.data });
      }

      const completedAt = new Date().toISOString();
      const status = execution.ok ? "succeeded" : "failed";
      const finalRun: WorkflowRun = {
        ...pendingRun,
        status,
        output: {
          summary: execution.ok
            ? `Workflow run completed for ${runWorkflow.metadata.name}.`
            : `Workflow run failed for ${runWorkflow.metadata.name}.`,
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
          new Date().toISOString(),
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
      const allEvents = [...existingEvents, ...nodeEvents, completionEvent];
      state.events.set(runId, allEvents);

      const buf = state.streamBuffers.get(runId);
      if (buf) {
        pushToBuffer(buf, { type: "run.completed", runId, status: status === "succeeded" ? "succeeded" : "failed" });
        buf.done = true;
        buf.listeners.clear();
        setTimeout(() => state.streamBuffers.delete(runId), 30_000);
      }

      // Persist the final state for authed runs, then evict from memory.
      if (userId) {
        runRepo.complete(userId, finalRun, allEvents).catch((error) => {
          logger.error("run.persist_complete_failed", {
            runId,
            message: error instanceof Error ? error.message : "persist failed",
          });
        });
      }
      evictRunFromMemory(runId);

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

  // List a workflow's run history (authed; durable). Anonymous runs have no
  // history (memory-only), so this requires a session.
  app.get(API_ROUTE_TEMPLATES.workflowRuns, async (c) => {
    const userId = await resolveUser(c);
    if (!userId) {
      return c.json(normalizedUnauthorized(), 401);
    }
    const workflowId = c.req.param("id");
    const runs = await runRepo.listRuns(userId, workflowId);
    return c.json(responseFromSchema(ListWorkflowRunsResponseSchema, { runs }));
  });

  app.get(API_ROUTE_TEMPLATES.run, async (c) => {
    const id = c.req.param("id");
    // Memory first (live + recent); fall back to the durable store for authed.
    let run = state.runs.get(id) ?? null;
    if (!run) {
      const userId = await resolveUser(c);
      if (userId) {
        run = await runRepo.get(userId, id);
      }
    }

    if (!run) {
      logger.warn("run.not_found", { runId: id, route: c.req.path });
      return c.json(normalizedNotFound(`Run ${id} was not found.`), 404);
    }

    return c.json(responseFromSchema(GetRunResponseSchema, { run }));
  });

  app.delete(API_ROUTE_TEMPLATES.run, async (c) => {
    const id = c.req.param("id");
    const userId = await resolveUser(c);
    let deleted = false;

    if (userId) {
      deleted = await runRepo.delete(userId, id);
    }

    const memoryOwner = state.runOwners.get(id);
    if (state.runs.has(id) && memoryOwner === userId) {
      state.runs.delete(id);
      state.events.delete(id);
      state.runWorkflows.delete(id);
      state.runOwners.delete(id);
      state.streamBuffers.delete(id);
      deleted = true;
    }

    if (!deleted) {
      if (!userId) {
        return c.json(normalizedUnauthorized(), 401);
      }
      return c.json(normalizedNotFound(`Run ${id} was not found.`), 404);
    }

    logger.info("run.deleted", { runId: id });
    return c.body(null, 204);
  });

  app.get(API_ROUTE_TEMPLATES.runEvents, async (c) => {
    const id = c.req.param("id");
    let events = state.events.get(id) ?? null;
    if (!events) {
      const userId = await resolveUser(c);
      if (userId) {
        events = await runRepo.listEvents(userId, id);
      }
    }

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
                const workflowNode = state.runWorkflows.get(id)?.graph.nodes.find((n) => n.id === nodeId);
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
