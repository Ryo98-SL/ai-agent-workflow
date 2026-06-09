import type {
  CreateKnowledgeBaseRequest,
  CreateTextKnowledgeDocumentRequest,
  KnowledgeBaseDto,
  KnowledgeBaseSettings,
  KnowledgeDocumentDto,
  KnowledgeDocumentStatus,
  KnowledgeRetrievalSegment,
  UpdateKnowledgeBaseRequest,
} from "@ai-agent-workflow/api-contracts";
import { randomUUID } from "node:crypto";
import { prisma } from "../db/prisma";
import {
  DEFAULT_KNOWLEDGE_BASE_SETTINGS,
  EXAMPLE_KNOWLEDGE_BASE_ID,
  KNOWLEDGE_ACCOUNT_CHAR_LIMIT,
  KNOWLEDGE_DOCUMENT_CHAR_LIMIT,
  KNOWLEDGE_DOCUMENTS_PER_BASE_LIMIT,
} from "./constants";
import { EXAMPLE_KNOWLEDGE_BASE, EXAMPLE_KNOWLEDGE_DOCUMENTS } from "./example";
import { normalizeKnowledgeText, parserForMimeType } from "./chunking";

export class KnowledgeRepositoryError extends Error {
  constructor(
    public readonly code: "read_only" | "quota_exceeded" | "unsupported_media",
    message: string,
  ) {
    super(message);
  }
}

export type IndexingDocument = {
  id: string;
  knowledgeBaseId: string;
  title: string;
  rawText: string;
  mimeType: string | null;
  settings: KnowledgeBaseSettings;
};

export type KnowledgeChunkInput = {
  ordinal: number;
  content: string;
  title: string;
  url?: string | null;
  icon?: string | null;
  metadata?: Record<string, unknown>;
  embedding: number[];
};

export type KnowledgeSearchOptions = {
  topK: number;
  scoreThreshold?: number;
};

export type KnowledgeRepository = {
  ensureExampleKnowledgeBase(): Promise<void>;
  list(userId: string | null): Promise<KnowledgeBaseDto[]>;
  get(userId: string | null, id: string): Promise<KnowledgeBaseDto | null>;
  create(userId: string, request: CreateKnowledgeBaseRequest): Promise<KnowledgeBaseDto>;
  update(userId: string, id: string, request: UpdateKnowledgeBaseRequest): Promise<KnowledgeBaseDto | null>;
  delete(userId: string, id: string): Promise<boolean>;
  listDocuments(userId: string | null, knowledgeBaseId: string): Promise<KnowledgeDocumentDto[] | null>;
  createTextDocument(
    userId: string,
    knowledgeBaseId: string,
    request: CreateTextKnowledgeDocumentRequest,
  ): Promise<KnowledgeDocumentDto | null>;
  deleteDocument(userId: string, documentId: string): Promise<boolean>;
  queueDocumentReindex(userId: string, documentId: string): Promise<KnowledgeDocumentDto | null>;
  claimNextIndexingDocument(staleBefore: Date): Promise<IndexingDocument | null>;
  markDocumentStatus(documentId: string, status: KnowledgeDocumentStatus, errorMessage?: string | null): Promise<void>;
  replaceDocumentChunks(document: IndexingDocument, chunks: KnowledgeChunkInput[]): Promise<void>;
  countReadyChunks(userId: string | null, knowledgeBaseIds: string[]): Promise<number>;
  searchReadyChunks(
    userId: string | null,
    knowledgeBaseIds: string[],
    queryEmbedding: number[],
    options: KnowledgeSearchOptions,
  ): Promise<KnowledgeRetrievalSegment[]>;
};

type KnowledgeBaseRow = {
  id: string;
  userId: string | null;
  name: string;
  description: string | null;
  visibility: string;
  settings: unknown;
  createdAt: Date;
  updatedAt: Date;
  documents?: Array<{ characterCount: number }>;
};

type KnowledgeDocumentRow = {
  id: string;
  knowledgeBaseId: string;
  title: string;
  sourceType: string;
  filename: string | null;
  mimeType: string | null;
  parser: unknown;
  characterCount: number;
  status: string;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type KnowledgeSearchRow = {
  id: string;
  knowledgeBaseId: string;
  knowledgeDocumentId: string;
  content: string;
  title: string;
  url: string | null;
  icon: string | null;
  metadata: unknown;
  score: number;
};

function nowIso() {
  return new Date().toISOString();
}

function dateIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value;
}

function mergeSettings(settings?: KnowledgeBaseSettings): KnowledgeBaseSettings {
  return {
    ...DEFAULT_KNOWLEDGE_BASE_SETTINGS,
    ...settings,
    embedding: { ...DEFAULT_KNOWLEDGE_BASE_SETTINGS.embedding, ...settings?.embedding },
    chunking: { ...DEFAULT_KNOWLEDGE_BASE_SETTINGS.chunking, ...settings?.chunking },
    retrieval: { ...DEFAULT_KNOWLEDGE_BASE_SETTINGS.retrieval, ...settings?.retrieval },
  };
}

function toBaseDto(row: KnowledgeBaseRow): KnowledgeBaseDto {
  const documentCount = row.documents?.length ?? 0;
  const characterCount = row.documents?.reduce((sum, document) => sum + document.characterCount, 0) ?? 0;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    visibility: row.visibility === "example" ? "example" : "private",
    readOnly: row.visibility === "example",
    settings: mergeSettings(row.settings as KnowledgeBaseSettings | undefined),
    documentCount,
    characterCount,
    createdAt: dateIso(row.createdAt),
    updatedAt: dateIso(row.updatedAt),
  };
}

function toDocumentDto(row: KnowledgeDocumentRow): KnowledgeDocumentDto {
  return {
    id: row.id,
    knowledgeBaseId: row.knowledgeBaseId,
    title: row.title,
    sourceType: row.sourceType === "file" ? "file" : "text",
    filename: row.filename,
    mimeType: row.mimeType,
    parser: (row.parser as KnowledgeDocumentDto["parser"]) ?? null,
    characterCount: row.characterCount,
    status: row.status as KnowledgeDocumentStatus,
    errorMessage: row.errorMessage,
    createdAt: dateIso(row.createdAt),
    updatedAt: dateIso(row.updatedAt),
  };
}

function canRead(userId: string | null, row: { userId: string | null; visibility: string }) {
  return row.visibility === "example" || (Boolean(userId) && row.userId === userId);
}

function assertTextDocumentAllowed(content: string) {
  if (content.length > KNOWLEDGE_DOCUMENT_CHAR_LIMIT) {
    throw new KnowledgeRepositoryError(
      "quota_exceeded",
      `Knowledge documents can contain at most ${KNOWLEDGE_DOCUMENT_CHAR_LIMIT} characters.`,
    );
  }
}

function toRetrievalSegment(row: KnowledgeSearchRow): KnowledgeRetrievalSegment {
  return {
    content: row.content,
    title: row.title,
    url: row.url,
    icon: row.icon,
    metadata: {
      knowledgeBaseId: row.knowledgeBaseId,
      documentId: row.knowledgeDocumentId,
      chunkId: row.id,
      score: row.score,
    },
    files: [],
  };
}

const db = prisma as any;

export function createPrismaKnowledgeRepository(): KnowledgeRepository {
  return {
    async ensureExampleKnowledgeBase() {
      const existing = await db.knowledgeBase.findUnique({ where: { id: EXAMPLE_KNOWLEDGE_BASE_ID } });
      if (existing) {
        return;
      }

      await db.knowledgeBase.create({
        data: {
          id: EXAMPLE_KNOWLEDGE_BASE.id,
          name: EXAMPLE_KNOWLEDGE_BASE.name,
          description: EXAMPLE_KNOWLEDGE_BASE.description,
          visibility: "example",
          settings: DEFAULT_KNOWLEDGE_BASE_SETTINGS,
          documents: {
            create: EXAMPLE_KNOWLEDGE_DOCUMENTS.map((document) => ({
              id: document.id,
              title: document.title,
              sourceType: "text",
              mimeType: "text/plain",
              parser: parserForMimeType("text/plain"),
              characterCount: document.content.length,
              rawText: document.content,
              status: "queued",
            })),
          },
        },
      });
    },

    async list(userId) {
      const rows = await db.knowledgeBase.findMany({
        where: {
          OR: [{ visibility: "example" }, ...(userId ? [{ userId }] : [])],
        },
        include: { documents: { select: { characterCount: true } } },
        orderBy: [{ visibility: "asc" }, { updatedAt: "desc" }],
      });
      return rows.map(toBaseDto);
    },

    async get(userId, id) {
      const row = await db.knowledgeBase.findUnique({
        where: { id },
        include: { documents: { select: { characterCount: true } } },
      });
      return row && canRead(userId, row) ? toBaseDto(row) : null;
    },

    async create(userId, request) {
      const row = await db.knowledgeBase.create({
        data: {
          userId,
          name: request.name,
          description: request.description,
          visibility: "private",
          settings: mergeSettings(request.settings as KnowledgeBaseSettings | undefined),
        },
        include: { documents: { select: { characterCount: true } } },
      });
      return toBaseDto(row);
    },

    async update(userId, id, request) {
      const existing = await db.knowledgeBase.findFirst({ where: { id, userId, visibility: "private" } });
      if (!existing) {
        return null;
      }
      const row = await db.knowledgeBase.update({
        where: { id },
        data: {
          ...(request.name ? { name: request.name } : {}),
          ...(request.description !== undefined ? { description: request.description } : {}),
          ...(request.settings ? { settings: mergeSettings(request.settings as KnowledgeBaseSettings) } : {}),
        },
        include: { documents: { select: { characterCount: true } } },
      });
      return toBaseDto(row);
    },

    async delete(userId, id) {
      const result = await db.knowledgeBase.deleteMany({ where: { id, userId, visibility: "private" } });
      return result.count > 0;
    },

    async listDocuments(userId, knowledgeBaseId) {
      const kb = await db.knowledgeBase.findUnique({ where: { id: knowledgeBaseId } });
      if (!kb || !canRead(userId, kb)) {
        return null;
      }
      const rows = await db.knowledgeDocument.findMany({
        where: { knowledgeBaseId },
        orderBy: { updatedAt: "desc" },
      });
      return rows.map(toDocumentDto);
    },

    async createTextDocument(userId, knowledgeBaseId, request) {
      const kb = await db.knowledgeBase.findFirst({
        where: { id: knowledgeBaseId, userId, visibility: "private" },
        include: { documents: { select: { characterCount: true } } },
      });
      if (!kb) {
        return null;
      }

      const content = normalizeKnowledgeText(request.content);
      assertTextDocumentAllowed(content);
      if (kb.documents.length >= KNOWLEDGE_DOCUMENTS_PER_BASE_LIMIT) {
        throw new KnowledgeRepositoryError(
          "quota_exceeded",
          `A knowledge base can contain at most ${KNOWLEDGE_DOCUMENTS_PER_BASE_LIMIT} documents.`,
        );
      }

      const usedCharacters = await db.knowledgeDocument.aggregate({
        where: { knowledgeBase: { userId, visibility: "private" } },
        _sum: { characterCount: true },
      });
      const total = (usedCharacters._sum.characterCount ?? 0) + content.length;
      if (total > KNOWLEDGE_ACCOUNT_CHAR_LIMIT) {
        throw new KnowledgeRepositoryError(
          "quota_exceeded",
          `An account can store at most ${KNOWLEDGE_ACCOUNT_CHAR_LIMIT} knowledge characters.`,
        );
      }

      const row = await db.knowledgeDocument.create({
        data: {
          knowledgeBaseId,
          title: request.title,
          sourceType: "text",
          mimeType: request.mimeType,
          parser: parserForMimeType(request.mimeType),
          characterCount: content.length,
          rawText: content,
          status: "queued",
        },
      });
      return toDocumentDto(row);
    },

    async deleteDocument(userId, documentId) {
      const result = await db.knowledgeDocument.deleteMany({
        where: { id: documentId, knowledgeBase: { userId, visibility: "private" } },
      });
      return result.count > 0;
    },

    async queueDocumentReindex(userId, documentId) {
      const existing = await db.knowledgeDocument.findFirst({
        where: { id: documentId, knowledgeBase: { userId, visibility: "private" } },
      });
      if (!existing) {
        return null;
      }
      const row = await db.knowledgeDocument.update({
        where: { id: documentId },
        data: { status: "queued", errorMessage: null, lockedAt: null },
      });
      return toDocumentDto(row);
    },

    async claimNextIndexingDocument(staleBefore) {
      const row = await db.knowledgeDocument.findFirst({
        where: {
          OR: [{ status: "queued" }, { status: { in: ["chunking", "embedding"] }, lockedAt: { lt: staleBefore } }],
        },
        include: { knowledgeBase: true },
        orderBy: { updatedAt: "asc" },
      });
      if (!row || !row.rawText) {
        return null;
      }
      await db.knowledgeDocument.update({
        where: { id: row.id },
        data: { status: "chunking", lockedAt: new Date(), errorMessage: null },
      });
      return {
        id: row.id,
        knowledgeBaseId: row.knowledgeBaseId,
        title: row.title,
        rawText: row.rawText,
        mimeType: row.mimeType,
        settings: mergeSettings(row.knowledgeBase.settings as KnowledgeBaseSettings | undefined),
      };
    },

    async markDocumentStatus(documentId, status, errorMessage = null) {
      await db.knowledgeDocument.update({
        where: { id: documentId },
        data: {
          status,
          errorMessage,
          lockedAt: status === "ready" || status === "failed" || status === "queued" ? null : new Date(),
          ...(status === "failed" ? { retryCount: { increment: 1 } } : {}),
        },
      });
    },

    async replaceDocumentChunks(document, chunks) {
      await db.$transaction(async (tx: any) => {
        await tx.knowledgeChunk.deleteMany({ where: { knowledgeDocumentId: document.id } });
        for (const chunk of chunks) {
          const id = randomUUID();
          const vector = `[${chunk.embedding.join(",")}]`;
          await tx.$executeRawUnsafe(
            `INSERT INTO "knowledge_chunk" ("id", "knowledgeBaseId", "knowledgeDocumentId", "ordinal", "content", "title", "url", "icon", "metadata", "embedding")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::vector)`,
            id,
            document.knowledgeBaseId,
            document.id,
            chunk.ordinal,
            chunk.content,
            chunk.title,
            chunk.url ?? null,
            chunk.icon ?? null,
            JSON.stringify(chunk.metadata ?? {}),
            vector,
          );
        }
      });
    },

    async countReadyChunks(userId, knowledgeBaseIds) {
      if (knowledgeBaseIds.length === 0) {
        return 0;
      }
      const rows = await db.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS "count"
        FROM "knowledge_chunk" chunk
        INNER JOIN "knowledge_base" kb ON kb."id" = chunk."knowledgeBaseId"
        INNER JOIN "knowledge_document" document ON document."id" = chunk."knowledgeDocumentId"
        WHERE chunk."knowledgeBaseId" = ANY($1::text[])
          AND document."status" = 'ready'
          AND (kb."visibility" = 'example' OR ($2::text IS NOT NULL AND kb."userId" = $2))`,
        knowledgeBaseIds,
        userId,
      );
      return Number((rows as Array<{ count: number }>)[0]?.count ?? 0);
    },

    async searchReadyChunks(userId, knowledgeBaseIds, queryEmbedding, options) {
      if (knowledgeBaseIds.length === 0) {
        return [];
      }

      const vector = `[${queryEmbedding.join(",")}]`;
      const thresholdSql = options.scoreThreshold == null ? "" : `AND (1 - (chunk."embedding" <=> $4::vector)) >= $5`;
      const sql = `SELECT
        chunk."id",
        chunk."knowledgeBaseId",
        chunk."knowledgeDocumentId",
        chunk."content",
        chunk."title",
        chunk."url",
        chunk."icon",
        chunk."metadata",
        (1 - (chunk."embedding" <=> $4::vector)) AS "score"
      FROM "knowledge_chunk" chunk
      INNER JOIN "knowledge_base" kb ON kb."id" = chunk."knowledgeBaseId"
      INNER JOIN "knowledge_document" document ON document."id" = chunk."knowledgeDocumentId"
      WHERE chunk."knowledgeBaseId" = ANY($1::text[])
        AND document."status" = 'ready'
        AND (kb."visibility" = 'example' OR ($2::text IS NOT NULL AND kb."userId" = $2))
        AND chunk."embedding" IS NOT NULL
        ${thresholdSql}
      ORDER BY chunk."embedding" <=> $4::vector ASC
      LIMIT $3`;
      const args =
        options.scoreThreshold == null
          ? [knowledgeBaseIds, userId, options.topK, vector]
          : [knowledgeBaseIds, userId, options.topK, vector, options.scoreThreshold];
      const rows = await db.$queryRawUnsafe(
        sql,
        ...args,
      );

      return (rows as KnowledgeSearchRow[]).map((row) =>
        toRetrievalSegment({
          ...row,
          metadata: typeof row.metadata === "object" && row.metadata !== null ? row.metadata : {},
          score: Number(row.score),
        }),
      );
    },
  };
}

export function createInMemoryKnowledgeRepository(): KnowledgeRepository {
  type BaseRecord = KnowledgeBaseDto & { userId: string | null; documents: Map<string, KnowledgeDocumentDto & { rawText: string | null }> };
  type StoredChunk = KnowledgeChunkInput & {
    id: string;
    knowledgeBaseId: string;
    knowledgeDocumentId: string;
  };
  const bases = new Map<string, BaseRecord>();
  const chunks = new Map<string, StoredChunk[]>();

  const upsertExample = () => {
    if (bases.has(EXAMPLE_KNOWLEDGE_BASE_ID)) {
      return;
    }
    const createdAt = "2026-06-07T00:00:00.000Z";
    const documents = new Map<string, KnowledgeDocumentDto & { rawText: string | null }>();
    for (const document of EXAMPLE_KNOWLEDGE_DOCUMENTS) {
      documents.set(document.id, {
        id: document.id,
        knowledgeBaseId: EXAMPLE_KNOWLEDGE_BASE_ID,
        title: document.title,
        sourceType: "text",
        filename: null,
        mimeType: "text/plain",
        parser: parserForMimeType("text/plain"),
        characterCount: document.content.length,
        status: "queued",
        errorMessage: null,
        createdAt,
        updatedAt: createdAt,
        rawText: document.content,
      });
    }
    bases.set(EXAMPLE_KNOWLEDGE_BASE_ID, {
      id: EXAMPLE_KNOWLEDGE_BASE_ID,
      userId: null,
      name: EXAMPLE_KNOWLEDGE_BASE.name,
      description: EXAMPLE_KNOWLEDGE_BASE.description,
      visibility: "example",
      readOnly: true,
      settings: DEFAULT_KNOWLEDGE_BASE_SETTINGS,
      documentCount: documents.size,
      characterCount: [...documents.values()].reduce((sum, document) => sum + document.characterCount, 0),
      createdAt,
      updatedAt: createdAt,
      documents,
    });
  };

  const refresh = (base: BaseRecord) => {
    base.documentCount = base.documents.size;
    base.characterCount = [...base.documents.values()].reduce((sum, document) => sum + document.characterCount, 0);
    base.updatedAt = nowIso();
    return base;
  };

  const visibleBases = (userId: string | null) =>
    [...bases.values()].filter((base) => base.visibility === "example" || (Boolean(userId) && base.userId === userId));

  const toKnowledgeBaseDto = (base: BaseRecord): KnowledgeBaseDto => ({
    id: base.id,
    name: base.name,
    description: base.description,
    visibility: base.visibility,
    readOnly: base.readOnly,
    settings: base.settings,
    documentCount: base.documentCount,
    characterCount: base.characterCount,
    createdAt: base.createdAt,
    updatedAt: base.updatedAt,
  });

  const toKnowledgeDocumentDto = (document: KnowledgeDocumentDto & { rawText: string | null }): KnowledgeDocumentDto => ({
    id: document.id,
    knowledgeBaseId: document.knowledgeBaseId,
    title: document.title,
    sourceType: document.sourceType,
    filename: document.filename,
    mimeType: document.mimeType,
    parser: document.parser,
    characterCount: document.characterCount,
    status: document.status,
    errorMessage: document.errorMessage,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  });

  return {
    async ensureExampleKnowledgeBase() {
      upsertExample();
    },
    async list(userId) {
      upsertExample();
      return visibleBases(userId).map(toKnowledgeBaseDto);
    },
    async get(userId, id) {
      upsertExample();
      const base = bases.get(id);
      if (!base || !canRead(userId, base)) return null;
      return toKnowledgeBaseDto(refresh(base));
    },
    async create(userId, request) {
      const id = `kb-${randomUUID()}`;
      const createdAt = nowIso();
      const base: BaseRecord = {
        id,
        userId,
        name: request.name,
        description: request.description ?? null,
        visibility: "private",
        readOnly: false,
        settings: mergeSettings(request.settings as KnowledgeBaseSettings | undefined),
        documentCount: 0,
        characterCount: 0,
        createdAt,
        updatedAt: createdAt,
        documents: new Map(),
      };
      bases.set(id, base);
      return toKnowledgeBaseDto(base);
    },
    async update(userId, id, request) {
      const base = bases.get(id);
      if (!base || base.userId !== userId || base.visibility !== "private") return null;
      if (request.name) base.name = request.name;
      if (request.description !== undefined) base.description = request.description;
      if (request.settings) base.settings = mergeSettings(request.settings as KnowledgeBaseSettings);
      return toKnowledgeBaseDto(refresh(base));
    },
    async delete(userId, id) {
      const base = bases.get(id);
      if (!base || base.userId !== userId || base.visibility !== "private") return false;
      bases.delete(id);
      return true;
    },
    async listDocuments(userId, knowledgeBaseId) {
      upsertExample();
      const base = bases.get(knowledgeBaseId);
      if (!base || !canRead(userId, base)) return null;
      return [...base.documents.values()].map(toKnowledgeDocumentDto);
    },
    async createTextDocument(userId, knowledgeBaseId, request) {
      const base = bases.get(knowledgeBaseId);
      if (!base || base.userId !== userId || base.visibility !== "private") return null;
      const content = normalizeKnowledgeText(request.content);
      assertTextDocumentAllowed(content);
      if (base.documents.size >= KNOWLEDGE_DOCUMENTS_PER_BASE_LIMIT) {
        throw new KnowledgeRepositoryError("quota_exceeded", `A knowledge base can contain at most ${KNOWLEDGE_DOCUMENTS_PER_BASE_LIMIT} documents.`);
      }
      const accountTotal = [...bases.values()]
        .filter((item) => item.userId === userId && item.visibility === "private")
        .reduce((sum, item) => sum + item.characterCount, 0);
      if (accountTotal + content.length > KNOWLEDGE_ACCOUNT_CHAR_LIMIT) {
        throw new KnowledgeRepositoryError("quota_exceeded", `An account can store at most ${KNOWLEDGE_ACCOUNT_CHAR_LIMIT} knowledge characters.`);
      }
      const createdAt = nowIso();
      const document = {
        id: `doc-${randomUUID()}`,
        knowledgeBaseId,
        title: request.title,
        sourceType: "text" as const,
        filename: null,
        mimeType: request.mimeType ?? "text/plain",
        parser: parserForMimeType(request.mimeType),
        characterCount: content.length,
        status: "queued" as const,
        errorMessage: null,
        createdAt,
        updatedAt: createdAt,
        rawText: content,
      };
      base.documents.set(document.id, document);
      refresh(base);
      return toKnowledgeDocumentDto(document);
    },
    async deleteDocument(userId, documentId) {
      for (const base of bases.values()) {
        if (base.userId === userId && base.visibility === "private" && base.documents.delete(documentId)) {
          refresh(base);
          return true;
        }
      }
      return false;
    },
    async queueDocumentReindex(userId, documentId) {
      for (const base of bases.values()) {
        const document = base.documents.get(documentId);
        if (document && base.userId === userId && base.visibility === "private") {
          document.status = "queued";
          document.errorMessage = null;
          document.updatedAt = nowIso();
          return toKnowledgeDocumentDto(document);
        }
      }
      return null;
    },
    async claimNextIndexingDocument() {
      upsertExample();
      for (const base of bases.values()) {
        for (const document of base.documents.values()) {
          if (document.status === "queued" && document.rawText) {
            document.status = "chunking";
            document.updatedAt = nowIso();
            return {
              id: document.id,
              knowledgeBaseId: base.id,
              title: document.title,
              rawText: document.rawText,
              mimeType: document.mimeType ?? null,
              settings: base.settings,
            };
          }
        }
      }
      return null;
    },
    async markDocumentStatus(documentId, status, errorMessage = null) {
      for (const base of bases.values()) {
        const document = base.documents.get(documentId);
        if (document) {
          document.status = status;
          document.errorMessage = errorMessage ?? null;
          document.updatedAt = nowIso();
        }
      }
    },
    async replaceDocumentChunks(document, documentChunks) {
      const nextChunks = documentChunks.map((chunk) => ({
        ...chunk,
        id: `chunk-${randomUUID()}`,
        knowledgeBaseId: document.knowledgeBaseId,
        knowledgeDocumentId: document.id,
      }));
      chunks.set(document.id, nextChunks);
    },
    async countReadyChunks(userId, knowledgeBaseIds) {
      const readableIds = new Set(
        knowledgeBaseIds.filter((id) => {
          const base = bases.get(id);
          return base && canRead(userId, base);
        }),
      );
      let count = 0;
      for (const chunkList of chunks.values()) {
        for (const chunk of chunkList) {
          if (!readableIds.has(chunk.knowledgeBaseId)) continue;
          const base = bases.get(chunk.knowledgeBaseId);
          const document = base?.documents.get(chunk.knowledgeDocumentId);
          if (document?.status === "ready") {
            count += 1;
          }
        }
      }
      return count;
    },
    async searchReadyChunks(userId, knowledgeBaseIds, queryEmbedding, options) {
      const readableIds = new Set(
        knowledgeBaseIds.filter((id) => {
          const base = bases.get(id);
          return base && canRead(userId, base);
        }),
      );
      const documents = new Map<string, KnowledgeDocumentDto & { rawText: string | null }>();
      for (const baseId of readableIds) {
        const base = bases.get(baseId);
        if (!base) continue;
        for (const document of base.documents.values()) {
          documents.set(document.id, document);
        }
      }

      const scored: KnowledgeRetrievalSegment[] = [...chunks.values()]
        .flat()
        .filter((chunk) => readableIds.has(chunk.knowledgeBaseId))
        .filter((chunk) => documents.get(chunk.knowledgeDocumentId)?.status === "ready")
        .map((chunk) => ({
          content: chunk.content,
          title: chunk.title,
          url: chunk.url ?? null,
          icon: chunk.icon ?? null,
          metadata: {
            knowledgeBaseId: chunk.knowledgeBaseId,
            documentId: chunk.knowledgeDocumentId,
            chunkId: chunk.id,
            score: cosineSimilarity(queryEmbedding, chunk.embedding),
          },
          files: [],
        }))
        .filter((segment) => options.scoreThreshold == null || segment.metadata.score >= options.scoreThreshold)
        .sort((left, right) => right.metadata.score - left.metadata.score)
        .slice(0, options.topK);

      return scored;
    },
  };
}

function cosineSimilarity(left: number[], right: number[]): number {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  const denominator = Math.sqrt(leftNorm) * Math.sqrt(rightNorm);
  return denominator > 0 ? dot / denominator : 0;
}
