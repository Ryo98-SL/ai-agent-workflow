import {
  ApiErrorResponseSchema,
  CreateFileKnowledgeDocumentRequestSchema,
  CreateKnowledgeBaseRequestSchema,
  CreateKnowledgeBaseResponseSchema,
  CreateKnowledgeDocumentResponseSchema,
  CreateTextKnowledgeDocumentRequestSchema,
  GetKnowledgeBaseResponseSchema,
  ListKnowledgeBasesResponseSchema,
  ListKnowledgeDocumentsResponseSchema,
  ReindexKnowledgeDocumentResponseSchema,
  UpdateKnowledgeBaseRequestSchema,
  UpdateKnowledgeBaseResponseSchema,
  apiPaths,
  createApiErrorResponse,
  zodIssuesToApiIssues,
} from "@ai-agent-workflow/api-contracts";
import { Hono, type Context } from "hono";
import type { z } from "zod";
import { logger } from "../logger";
import { type KnowledgeIndexingRunner } from "../knowledge/indexer";
import { KnowledgeRepositoryError, type KnowledgeRepository } from "../knowledge/repository";

type KnowledgeRoutesOptions = {
  repository: KnowledgeRepository;
  resolveUserId: (c: Context) => Promise<string | null>;
  indexer?: Pick<KnowledgeIndexingRunner, "trigger">;
};

async function readJsonBody(request: Request): Promise<unknown> {
  const raw = await request.text();
  if (raw.trim() === "") return {};
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

function unauthorized() {
  return responseFromSchema(
    ApiErrorResponseSchema,
    createApiErrorResponse("unauthorized", "Authentication is required for this resource."),
  );
}

function notFound(message: string) {
  return responseFromSchema(ApiErrorResponseSchema, createApiErrorResponse("not_found", message));
}

function errorStatus(error: KnowledgeRepositoryError): 400 | 409 {
  return error.code === "quota_exceeded" ? 409 : 400;
}

export function createKnowledgeRoutes({ repository, resolveUserId, indexer }: KnowledgeRoutesOptions) {
  const app = new Hono();

  void repository.ensureExampleKnowledgeBase().catch((error) => {
    logger.error("knowledge.example_seed_failed", {
      message: error instanceof Error ? error.message : "seed failed",
    });
  });

  app.get(apiPaths.knowledgeBases(), async (c) => {
    const userId = await resolveUserId(c);
    const knowledgeBases = await repository.list(userId);
    return c.json(responseFromSchema(ListKnowledgeBasesResponseSchema, { knowledgeBases }));
  });

  app.post(apiPaths.knowledgeBases(), async (c) => {
    const userId = await resolveUserId(c);
    if (!userId) {
      return c.json(unauthorized(), 401);
    }
    const parsed = await parseJsonRequest(c.req.raw, CreateKnowledgeBaseRequestSchema);
    if (!parsed.ok) {
      return c.json(parsed.body, parsed.status);
    }
    const knowledgeBase = await repository.create(userId, parsed.data);
    return c.json(responseFromSchema(CreateKnowledgeBaseResponseSchema, { knowledgeBase }), 201);
  });

  app.get("/api/knowledge-bases/:id", async (c) => {
    const userId = await resolveUserId(c);
    const id = c.req.param("id");
    const knowledgeBase = await repository.get(userId, id);
    if (!knowledgeBase) {
      return c.json(notFound(`Knowledge base ${id} was not found.`), 404);
    }
    return c.json(responseFromSchema(GetKnowledgeBaseResponseSchema, { knowledgeBase }));
  });

  app.patch("/api/knowledge-bases/:id", async (c) => {
    const userId = await resolveUserId(c);
    if (!userId) {
      return c.json(unauthorized(), 401);
    }
    const parsed = await parseJsonRequest(c.req.raw, UpdateKnowledgeBaseRequestSchema);
    if (!parsed.ok) {
      return c.json(parsed.body, parsed.status);
    }
    const id = c.req.param("id");
    const knowledgeBase = await repository.update(userId, id, parsed.data);
    if (!knowledgeBase) {
      return c.json(notFound(`Knowledge base ${id} was not found.`), 404);
    }
    return c.json(responseFromSchema(UpdateKnowledgeBaseResponseSchema, { knowledgeBase }));
  });

  app.delete("/api/knowledge-bases/:id", async (c) => {
    const userId = await resolveUserId(c);
    if (!userId) {
      return c.json(unauthorized(), 401);
    }
    const id = c.req.param("id");
    const deleted = await repository.delete(userId, id);
    if (!deleted) {
      return c.json(notFound(`Knowledge base ${id} was not found.`), 404);
    }
    return c.body(null, 204);
  });

  app.get("/api/knowledge-bases/:id/documents", async (c) => {
    const userId = await resolveUserId(c);
    const id = c.req.param("id");
    const documents = await repository.listDocuments(userId, id);
    if (!documents) {
      return c.json(notFound(`Knowledge base ${id} was not found.`), 404);
    }
    return c.json(responseFromSchema(ListKnowledgeDocumentsResponseSchema, { documents }));
  });

  app.post("/api/knowledge-bases/:id/documents/text", async (c) => {
    const userId = await resolveUserId(c);
    if (!userId) {
      return c.json(unauthorized(), 401);
    }
    const parsed = await parseJsonRequest(c.req.raw, CreateTextKnowledgeDocumentRequestSchema);
    if (!parsed.ok) {
      return c.json(parsed.body, parsed.status);
    }
    try {
      const document = await repository.createTextDocument(userId, c.req.param("id"), parsed.data);
      if (!document) {
        return c.json(notFound(`Knowledge base ${c.req.param("id")} was not found.`), 404);
      }
      indexer?.trigger();
      return c.json(responseFromSchema(CreateKnowledgeDocumentResponseSchema, { document }), 201);
    } catch (error) {
      if (error instanceof KnowledgeRepositoryError) {
        return c.json(createApiErrorResponse(error.code === "quota_exceeded" ? "conflict" : "bad_request", error.message), errorStatus(error));
      }
      throw error;
    }
  });

  app.post("/api/knowledge-bases/:id/documents/file", async (c) => {
    const userId = await resolveUserId(c);
    if (!userId) {
      return c.json(unauthorized(), 401);
    }
    const parsed = await parseJsonRequest(c.req.raw, CreateFileKnowledgeDocumentRequestSchema);
    if (!parsed.ok) {
      return c.json(parsed.body, parsed.status);
    }
    if (parsed.data.mimeType === "application/pdf") {
      return c.json(createApiErrorResponse("bad_request", "PDF upload is reserved for a later release."), 400);
    }
    if (!parsed.data.content) {
      return c.json(createApiErrorResponse("bad_request", "Text file content is required for MVP ingestion."), 400);
    }
    try {
      const document = await repository.createTextDocument(userId, c.req.param("id"), {
        title: parsed.data.filename,
        content: parsed.data.content,
        mimeType: parsed.data.mimeType,
      });
      if (!document) {
        return c.json(notFound(`Knowledge base ${c.req.param("id")} was not found.`), 404);
      }
      indexer?.trigger();
      return c.json(responseFromSchema(CreateKnowledgeDocumentResponseSchema, { document }), 201);
    } catch (error) {
      if (error instanceof KnowledgeRepositoryError) {
        return c.json(createApiErrorResponse(error.code === "quota_exceeded" ? "conflict" : "bad_request", error.message), errorStatus(error));
      }
      throw error;
    }
  });

  app.delete("/api/knowledge-documents/:id", async (c) => {
    const userId = await resolveUserId(c);
    if (!userId) {
      return c.json(unauthorized(), 401);
    }
    const deleted = await repository.deleteDocument(userId, c.req.param("id"));
    if (!deleted) {
      return c.json(notFound(`Knowledge document ${c.req.param("id")} was not found.`), 404);
    }
    return c.body(null, 204);
  });

  app.post("/api/knowledge-documents/:id/reindex", async (c) => {
    const userId = await resolveUserId(c);
    if (!userId) {
      return c.json(unauthorized(), 401);
    }
    const document = await repository.queueDocumentReindex(userId, c.req.param("id"));
    if (!document) {
      return c.json(notFound(`Knowledge document ${c.req.param("id")} was not found.`), 404);
    }
    indexer?.trigger();
    return c.json(responseFromSchema(ReindexKnowledgeDocumentResponseSchema, { document }));
  });

  return app;
}
