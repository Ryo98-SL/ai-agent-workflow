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
  ResumeRunRequestSchema,
  ResumeRunResponseSchema,
  UpdateWorkflowRequestSchema,
  UpdateWorkflowResponseSchema,
  apiPaths,
  createApiErrorResponse,
  zodIssuesToApiIssues,
  type RunEvent,
  type RunInput,
  type RunInterrupt,
  type RunSseEvent,
  type WorkflowDto,
  type WorkflowRun,
  type WorkflowRunOutput,
  type WorkflowSummary,
} from "@ai-agent-workflow/api-contracts";
import {
  createDefaultWorkflow,
  type ModelProvider,
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
import {
  consumeCredits,
  createCreditRoutes,
  loadCreditBalance,
  loadPlatformCreditsProvider,
  type PlatformCreditsProvider,
} from "./routes/credits";
import { createKnowledgeRoutes } from "./routes/knowledge";
import { createMcpRoutes } from "./routes/mcp";
import { createPrismaMcpRepository, type McpRepository } from "./mcp/repository";
import type { McpServerConnection } from "./mcp/client";
import { handleBuiltinMcpRequest } from "./mcp/builtin-server";
import { loadMcpConnections } from "./mcp/connections";
import { executeWorkflowRuntime, type EmailSender } from "./runtime";
import type { ToolDescriptor } from "@ai-agent-workflow/workflow-domain";
import { frontendOrigins, getPlatformEmbeddingConfig } from "./config";
import { createPlatformEmbeddingAdapter, type EmbeddingAdapter } from "./knowledge/embeddings";
import { createKnowledgeIndexingRunner, type KnowledgeIndexingRunner } from "./knowledge/indexer";
import { createPrismaKnowledgeRepository, type KnowledgeRepository } from "./knowledge/repository";
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
  // LangGraph thread id per run (= conversationId for multi-turn memory, else runId).
  runThreads: Map<string, string>;
  checkpointer: BaseCheckpointSaver;
};

export type CreateServerAppOptions = {
  fetch?: typeof fetch;
  /** Workflow persistence. Defaults to the Prisma-backed repository. */
  workflows?: WorkflowRepository;
  /** Run persistence (authed runs). Defaults to the Prisma-backed repository. */
  runs?: RunRepository;
  /** Knowledge Base persistence. Defaults to the Prisma-backed repository. */
  knowledge?: KnowledgeRepository;
  /** MCP server persistence. Defaults to the Prisma-backed repository. */
  mcp?: McpRepository;
  /** MCP snapshot connector override (tests/e2e). Defaults to the live `snapshotTools`. */
  mcpSnapshot?: (server: McpServerConnection) => Promise<ToolDescriptor[]>;
  /** Platform embedding adapter for KB indexing. Defaults to env-configured OpenAI-compatible embeddings. */
  embeddings?: EmbeddingAdapter;
  /** Optional runner override for tests. */
  knowledgeIndexer?: KnowledgeIndexingRunner;
  /** Platform provider key loader for AI credits. Defaults to the DB-backed DeepSeek-only loader. */
  platformCreditsProvider?: (provider: string) => Promise<PlatformCreditsProvider | null>;
  /** Credit balance loader override for tests. Defaults to the Prisma-backed grant store. */
  creditBalanceLoader?: (userId: string) => Promise<number | null>;
  /** Credit consumption override for tests. Defaults to the Prisma-backed grant store. */
  creditConsumer?: (userId: string, tokens: number) => Promise<void>;
  /** Email sender for the Email tool. Defaults to env-gated Resend (undefined when unset → dry-run only). */
  emailSender?: EmailSender;
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
    runThreads: new Map(),
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

function resolveRunProvider(workflow: WorkflowFile, modelProvider?: OpenAICompatibleSettings): ModelProvider | undefined {
  const llmProviders = new Set<ModelProvider>();
  for (const node of workflow.graph.nodes) {
    if (node.type !== "llm") continue;
    const provider = node.config.modelSettings?.provider ?? modelProvider?.provider ?? workflow.settings.modelProvider?.provider;
    if (provider) {
      llmProviders.add(provider);
    }
  }

  if (llmProviders.size === 1) {
    return [...llmProviders][0];
  }

  return modelProvider?.provider ?? workflow.settings.modelProvider?.provider;
}

/**
 * Env-gated Resend sender for the Email tool's real-send path. Returns
 * undefined when RESEND_API_KEY/EMAIL_FROM are unset, so the node falls back to
 * a clear "not configured" error and dry-run stays the default everywhere.
 */
function createEnvEmailSender(fetchImpl?: typeof fetch): EmailSender | undefined {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    return undefined;
  }
  const doFetch = fetchImpl ?? fetch;
  return async (email) => {
    const response = await doFetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: email.to, subject: email.subject, text: email.body }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Email send failed (${response.status}): ${detail.slice(0, 200)}`);
    }
    const payload = (await response.json().catch(() => ({}))) as { id?: string };
    return { id: payload.id };
  };
}

/** Maps a runtime interrupt (the node's `interrupt()` payload) to the DTO. */
function toRunInterrupt(interrupt: { nodeId: string; interruptId?: string; value: unknown }): RunInterrupt {
  const value = (interrupt.value ?? {}) as Record<string, unknown>;
  const actions = Array.isArray(value.actions)
    ? value.actions.map((action) => {
        const entry = (action ?? {}) as Record<string, unknown>;
        return { id: String(entry.id ?? ""), label: String(entry.label ?? ""), value: String(entry.value ?? "") };
      })
    : [];
  return {
    nodeId: interrupt.nodeId,
    interruptId: interrupt.interruptId,
    prompt: typeof value.prompt === "string" ? value.prompt : "",
    actions,
    allowTextInput: Boolean(value.allowTextInput),
    inputLabel: typeof value.inputLabel === "string" ? value.inputLabel : undefined,
    defaultText: typeof value.defaultText === "string" ? value.defaultText : undefined,
  };
}

/** Unions node results across run legs (resume re-runs only the tail). */
function mergeNodeResults(
  prior: WorkflowRunOutput["nodeResults"],
  next: ReadonlyArray<{
    nodeId: string;
    label: string;
    status: "succeeded" | "failed";
    output: string;
    data?: Record<string, unknown>;
  }>,
): WorkflowRunOutput["nodeResults"] {
  const byId = new Map<string, WorkflowRunOutput["nodeResults"][number]>();
  for (const result of prior) {
    byId.set(result.nodeId, result);
  }
  for (const result of next) {
    byId.set(result.nodeId, {
      nodeId: result.nodeId,
      label: result.label,
      status: result.status,
      output: result.output,
      data: result.data,
    });
  }
  return [...byId.values()];
}

function workflowForRun(
  workflow: WorkflowFile,
  modelProvider?: OpenAICompatibleSettings,
  modelProviderKeys?: ModelProviderKeys,
  // When set (credits runs), force this base URL at both the workflow and node
  // level and drop node-level apiKey overrides so the injected platform key can
  // only ever reach the official provider endpoint.
  forceBaseURL?: string,
): WorkflowFile {
  if (!modelProvider && !modelProviderKeys && !forceBaseURL) {
    return workflow;
  }

  const baseProvider = modelProvider || workflow.settings.modelProvider;
  const clone = cloneWorkflow(workflow);

  const result: WorkflowFile = {
    ...clone,
    settings: {
      ...workflow.settings,
      modelProvider: baseProvider && forceBaseURL ? { ...baseProvider, baseURL: forceBaseURL } : baseProvider,
      modelProviderKeys: {
        ...workflow.settings.modelProviderKeys,
        ...modelProviderKeys,
      },
    },
  };

  if (forceBaseURL) {
    result.graph = {
      ...result.graph,
      nodes: result.graph.nodes.map((node) =>
        node.type === "llm" && node.config.modelSettings
          ? {
              ...node,
              config: {
                ...node.config,
                modelSettings: { ...node.config.modelSettings, baseURL: forceBaseURL, apiKey: undefined },
              },
            }
          : node,
      ),
    };
  }

  return result;
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
  const knowledge = options.knowledge ?? createPrismaKnowledgeRepository();
  const mcp = options.mcp ?? createPrismaMcpRepository();
  const platformCreditsProvider = options.platformCreditsProvider ?? loadPlatformCreditsProvider;
  const creditBalanceLoader = options.creditBalanceLoader ?? loadCreditBalance;
  const creditConsumer = options.creditConsumer ?? consumeCredits;
  // Undefined unless RESEND_API_KEY + EMAIL_FROM are set; then the Email tool's
  // "send for real" path works (otherwise it errors and dry-run is the default).
  const emailSender = options.emailSender ?? createEnvEmailSender(options.fetch);
  const embeddingConfig = getPlatformEmbeddingConfig();
  const embeddings = options.embeddings ?? (embeddingConfig ? createPlatformEmbeddingAdapter(options.fetch, embeddingConfig) : undefined);
  const knowledgeIndexer =
    options.knowledgeIndexer ??
    (embeddings
      ? createKnowledgeIndexingRunner({ repository: knowledge, embedding: embeddings })
      : {
          start() {
            logger.warn("knowledge.indexing.disabled", {
              reason: "Platform embedding API key is not configured.",
            });
          },
          stop() {},
          trigger() {},
        });
  const resolveUser = options.resolveUserId ?? resolveUserId;
  const app = new Hono();
  knowledgeIndexer.start();

  function evictRunFromMemory(runId: string) {
    setTimeout(() => {
      state.runs.delete(runId);
      state.events.delete(runId);
      state.runWorkflows.delete(runId);
      state.runOwners.delete(runId);
      state.runThreads.delete(runId);
      state.streamBuffers.delete(runId);
    }, RUN_MEMORY_TTL_MS);
  }

  type LaunchRunParams = {
    runId: string;
    workflowId: string;
    runWorkflow: WorkflowFile;
    pendingRun: WorkflowRun;
    input: RunInput;
    /** Chat Mode: this turn's user message (the `{{userInput.query}}` value). */
    query?: string;
    userId: string | null;
    /** LangGraph thread id (= conversationId for memory, else runId). */
    threadId: string;
    modelProvider?: OpenAICompatibleSettings;
    effectiveProviderKeys?: ModelProviderKeys;
    creditsBaseURL?: string;
    creditBudget?: number;
    /** Resume answer for a paused Human Input interrupt (re-enters the thread). */
    resume?: { value: unknown };
    /** Node results from earlier legs, merged into the persisted run output. */
    priorNodeResults?: WorkflowRunOutput["nodeResults"];
  };

  // Runs (or resumes) a workflow on its own SSE buffer, then records the outcome.
  // Shared by the create and resume routes so pause/resume reuses one pipeline.
  function launchRunExecution(params: LaunchRunParams) {
    const {
      runId,
      workflowId,
      runWorkflow,
      pendingRun,
      input,
      query,
      userId,
      threadId,
      modelProvider,
      effectiveProviderKeys,
      creditsBaseURL,
      creditBudget,
      resume,
      priorNodeResults,
    } = params;

    const nodeOutputs = new Map<
      string,
      { output: string; data?: Record<string, unknown>; inputTokens?: number; outputTokens?: number }
    >();

    // Authed runs use the durable Postgres checkpointer (when available);
    // anonymous runs use the ephemeral in-memory MemorySaver.
    const checkpointer = userId && options.authedCheckpointer ? options.authedCheckpointer : state.checkpointer;

    void executeWorkflowRuntime(
      workflowForRun(runWorkflow, modelProvider, effectiveProviderKeys, creditsBaseURL),
      input,
      {
        checkpointer,
        embeddings,
        fetch: options.fetch,
        knowledge,
        threadId,
        query,
        creditBudget,
        userId,
        emailSender,
        // Agent MCP tools resolve connections at run time (ADR 0004 — never a
        // process-global): the built-in server (ADR 0006) for everyone, plus a
        // signed-in user's own servers. Available to anonymous runs too.
        mcpServers: () => loadMcpConnections(mcp, userId),
        resume,
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
          } else if (event.type === "agent.tool" && event.nodeId && (event.phase === "start" || event.phase === "end")) {
            pushToBuffer(buf, {
              type: "agent.tool",
              runId,
              nodeId: event.nodeId,
              tool: event.tool,
              phase: event.phase,
              result: typeof event.result === "string" ? event.result : undefined,
            });
          }
        },
      },
    )
      .then(async (execution) => {
        // Deduct metered tokens from the credit balance (credits runs only).
        if (creditBudget != null && userId && execution.consumedTokens > 0) {
          try {
            await creditConsumer(userId, execution.consumedTokens);
          } catch (error) {
            logger.error("credits.consume_failed", {
              runId,
              message: error instanceof Error ? error.message : "consume failed",
            });
          }
        }

        const mergedNodeResults = mergeNodeResults(priorNodeResults ?? [], execution.nodeResults);
        const existingEvents = state.events.get(runId) ?? [];
        const base = existingEvents.length;
        const nodeEvents = execution.nodeResults.map((result, index) =>
          createEvent(
            runId,
            base + index,
            result.status === "failed" ? "node.failed" : "node.completed",
            `${result.label} ${result.status === "failed" ? "failed" : "completed"}.`,
            new Date().toISOString(),
            { nodeId: result.nodeId, output: result.output, data: result.data },
          ),
        );

        // Paused on a Human Input interrupt: record the waiting state and close
        // this SSE leg. The run stays in memory until a resume re-enters it.
        if (execution.ok && execution.status === "waiting_human") {
          const interrupt = execution.interrupt ? toRunInterrupt(execution.interrupt) : null;
          const waitingRun: WorkflowRun = {
            ...pendingRun,
            status: "waiting_human",
            interrupt,
            output: {
              summary: `Workflow run awaiting human input for ${runWorkflow.metadata.name}.`,
              nodeResults: mergedNodeResults,
            },
            error: null,
            completedAt: null,
          };
          state.runs.set(runId, waitingRun);

          const waitingEvent = createEvent(
            runId,
            base + execution.nodeResults.length,
            "run.waiting",
            `Run ${runId} is awaiting human input.`,
            new Date().toISOString(),
            { nodeId: interrupt?.nodeId },
          );
          state.events.set(runId, [...existingEvents, ...nodeEvents, waitingEvent]);

          const buf = state.streamBuffers.get(runId);
          if (buf) {
            if (interrupt) {
              pushToBuffer(buf, { type: "run.waiting", runId, interrupt });
            }
            buf.done = true;
            buf.listeners.clear();
            setTimeout(() => state.streamBuffers.delete(runId), 30_000);
          }

          logger.info("run.waiting_human", { runId, workflowId, nodeId: interrupt?.nodeId });
          return;
        }

        const completedAt = new Date().toISOString();
        const status = execution.ok ? "succeeded" : "failed";
        const finalRun: WorkflowRun = {
          ...pendingRun,
          status,
          interrupt: null,
          output: {
            summary: execution.ok
              ? `Workflow run completed for ${runWorkflow.metadata.name}.`
              : `Workflow run failed for ${runWorkflow.metadata.name}.`,
            nodeResults: mergedNodeResults,
          },
          error: execution.ok ? null : execution.error,
          completedAt,
        };
        state.runs.set(runId, finalRun);

        const completionEvent = createEvent(
          runId,
          base + execution.nodeResults.length,
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

        logger.info("run.finished", {
          runId,
          workflowId,
          status,
          nodeResultCount: mergedNodeResults.length,
          errorCode: execution.ok ? null : execution.error.code,
        });
      })
      .catch((error) => {
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
  }

  // Credentialed CORS locked to the frontend origin so the Better Auth session
  // cookie can be sent cross-origin (shared parent domain in production).
  app.use(
    "*",
    cors({
      origin: frontendOrigins,
      credentials: true,
      allowHeaders: ["Content-Type", "Authorization"],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    }),
  );

  app.get("/", (c) => c.text("Hello from AI Agent Workflow server."));

  // Better Auth handles /api/auth/* (sign-in, sign-up, OAuth callbacks, session).
  app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

  // User-private account resources (provider keys, custom models).
  app.route("/", createAccountRoutes());
  // AI credits: status + one-time auto-approved application.
  app.route("/", createCreditRoutes());
  // User-level reusable Knowledge Bases plus the read-only anonymous example KB.
  app.route("/", createKnowledgeRoutes({ repository: knowledge, resolveUserId: resolveUser, indexer: knowledgeIndexer }));
  // Account-level MCP servers (HTTP) — registered, snapshotted, and pickable as tools.
  app.route("/", createMcpRoutes({ repository: mcp, resolveUserId: resolveUser, snapshot: options.mcpSnapshot }));
  // Built-in MCP server (ADR 0006): platform-hosted, auth-less, read-only example
  // server. Self-connected at run time via @langchain/mcp-adapters; no auth gate.
  app.all("/mcp/builtin", (c) => handleBuiltinMcpRequest(c.req.raw));

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

  // Resolves which provider key the run uses and whether it draws on AI credits
  // (and the metering budget). Shared by the create and resume routes.
  async function resolveRunCredentials(args: {
    userId: string | null;
    runWorkflow: WorkflowFile;
    modelProviderKeys?: ModelProviderKeys;
    modelProvider?: OpenAICompatibleSettings;
    providerKeyId?: string;
  }): Promise<
    | { ok: true; effectiveProviderKeys?: ModelProviderKeys; creditBudget?: number; creditsBaseURL?: string }
    | { ok: false; error: ReturnType<typeof createApiErrorResponse>; status: 402 }
  > {
    let effectiveProviderKeys = args.modelProviderKeys;
    const runProvider = resolveRunProvider(args.runWorkflow, args.modelProvider);
    const savedPref = runProvider ? args.runWorkflow.settings.providerKeyPrefs?.[runProvider] : undefined;
    const savedUsagePriority = savedPref?.usagePriority ?? "credits";
    const requestModelProvider = args.modelProvider;
    const hasResolvedProviderKey =
      Boolean(runProvider && effectiveProviderKeys?.[runProvider]) ||
      Boolean(runProvider && args.runWorkflow.settings.modelProviderKeys?.[runProvider]);
    const hasTransientProviderApiKey = requestModelProvider
      ? requestModelProvider.provider === runProvider && Boolean(requestModelProvider.apiKey)
      : false;
    const usesCredits =
      savedUsagePriority === "credits" &&
      !args.providerKeyId &&
      !hasTransientProviderApiKey &&
      !hasResolvedProviderKey;
    if (runProvider && runProvider !== "ollama" && !effectiveProviderKeys?.[runProvider] && args.userId && !usesCredits) {
      const selectedKeyId = args.providerKeyId ?? savedPref?.providerKeyId;
      const storedKey = selectedKeyId
        ? await loadDecryptedProviderKeyById(args.userId, selectedKeyId)
        : await loadDecryptedProviderKey(args.userId, runProvider);
      if (storedKey) {
        effectiveProviderKeys = { ...effectiveProviderKeys, [runProvider]: storedKey };
      }
    }

    // Credits path: when a paid provider runs on AI credits (no key resolved),
    // require an approved grant with a positive balance, inject the platform's
    // provider key, force the official endpoint, and meter the run.
    let creditBudget: number | undefined;
    let creditsBaseURL: string | undefined;
    const needsCredits = Boolean(runProvider) && runProvider !== "ollama" && usesCredits;
    if (needsCredits) {
      if (!args.userId) {
        return {
          ok: false,
          status: 402,
          error: createApiErrorResponse(
            "credits_required",
            "Sign in and apply for AI credits, or add an API key for this provider.",
          ),
        };
      }
      const balance = await creditBalanceLoader(args.userId);
      if (balance == null) {
        return {
          ok: false,
          status: 402,
          error: createApiErrorResponse("credits_required", "Apply for AI credits or add an API key for this provider."),
        };
      }
      if (balance <= 0) {
        return {
          ok: false,
          status: 402,
          error: createApiErrorResponse("credits_exhausted", "AI credits exhausted. Apply for more or add an API key."),
        };
      }
      const platform = await platformCreditsProvider(runProvider!);
      if (!platform) {
        return {
          ok: false,
          status: 402,
          error: createApiErrorResponse(
            "credits_required",
            `AI credits aren't available for ${runProvider} yet — add an API key for this provider.`,
          ),
        };
      }
      effectiveProviderKeys = { ...effectiveProviderKeys, [runProvider!]: platform.apiKey };
      creditsBaseURL = platform.baseURL;
      creditBudget = balance;
    }

    return { ok: true, effectiveProviderKeys, creditBudget, creditsBaseURL };
  }

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
    // Usage priority gates this: when the provider runs on "credits" we skip
    // user-key injection and let the platform key path handle it. Missing saved
    // preference defaults to credits, matching the UI's default. Only explicit
    // API-key mode resolves a key by: the request's providerKeyId override →
    // the saved providerKeyPrefs selection → the most recent stored key
    // (back-compat).
    const credentials = await resolveRunCredentials({
      userId,
      runWorkflow,
      modelProviderKeys: parsed.data.modelProviderKeys,
      modelProvider: parsed.data.modelProvider,
      providerKeyId: parsed.data.providerKeyId,
    });
    if (!credentials.ok) {
      return c.json(credentials.error, credentials.status);
    }
    const { effectiveProviderKeys, creditBudget, creditsBaseURL } = credentials;

    const runId = randomUUID();
    // Multi-turn memory: runs sharing a conversationId share a LangGraph thread,
    // so memory-enabled nodes accumulate history across turns.
    const threadId = parsed.data.conversationId?.trim() || runId;
    state.runWorkflows.set(runId, runWorkflow);
    state.runThreads.set(runId, threadId);
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

    launchRunExecution({
      runId,
      workflowId,
      runWorkflow,
      pendingRun,
      input: parsed.data.input,
      query: parsed.data.query,
      userId,
      threadId,
      modelProvider: parsed.data.modelProvider,
      effectiveProviderKeys,
      creditsBaseURL,
      creditBudget,
    });

    return c.json(responseFromSchema(CreateRunResponseSchema, { run: pendingRun }), 201);
  });

  // Resume a run paused on a Human Input interrupt. Re-enters the same thread
  // with the reviewer's answer and opens a fresh SSE leg for the continuation.
  app.post(API_ROUTE_TEMPLATES.runResume, async (c) => {
    const runId = c.req.param("id");

    const parsed = await parseJsonRequest(c.req.raw, ResumeRunRequestSchema);
    if (!parsed.ok) {
      return c.json(parsed.body, parsed.status);
    }

    const userId = await resolveUser(c);

    // The waiting run, its owner, and its workflow are all held in memory while
    // paused (waiting runs are never evicted until they finish).
    const run = state.runs.get(runId) ?? null;
    if (!run || state.runOwners.get(runId) !== userId) {
      logger.warn("run.not_found", { runId, route: c.req.path });
      return c.json(normalizedNotFound(`Run ${runId} was not found.`), 404);
    }
    if (run.status !== "waiting_human") {
      return c.json(createApiErrorResponse("conflict", `Run ${runId} is not awaiting human input.`), 409);
    }
    const runWorkflow = state.runWorkflows.get(runId);
    if (!runWorkflow) {
      return c.json(normalizedNotFound(`Run ${runId} can no longer be resumed.`), 404);
    }

    const credentials = await resolveRunCredentials({ userId, runWorkflow });
    if (!credentials.ok) {
      return c.json(credentials.error, credentials.status);
    }

    // Fresh SSE buffer for the resumed leg; the client re-subscribes to stream.
    const buffer: RunStreamBuffer = { events: [], done: false, listeners: new Set() };
    state.streamBuffers.set(runId, buffer);
    pushToBuffer(buffer, { type: "run.started", runId });

    const resumedRun: WorkflowRun = { ...run, status: "running", interrupt: null };
    state.runs.set(runId, resumedRun);

    logger.info("run.resume_requested", { runId, workflowId: run.workflowId, actionId: parsed.data.action_id });

    launchRunExecution({
      runId,
      workflowId: run.workflowId,
      runWorkflow,
      pendingRun: resumedRun,
      input: run.input,
      userId,
      threadId: state.runThreads.get(runId) ?? runId,
      effectiveProviderKeys: credentials.effectiveProviderKeys,
      creditsBaseURL: credentials.creditsBaseURL,
      creditBudget: credentials.creditBudget,
      resume: { value: { action_id: parsed.data.action_id, action_value: parsed.data.action_value } },
      priorNodeResults: run.output?.nodeResults ?? [],
    });

    return c.json(responseFromSchema(ResumeRunResponseSchema, { run: resumedRun }), 200);
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
      state.runThreads.delete(id);
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
