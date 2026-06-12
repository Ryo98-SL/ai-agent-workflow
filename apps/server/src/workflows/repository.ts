import type { WorkflowDto } from "@ai-agent-workflow/api-contracts";
import { createDefaultWorkflow, validateWorkflowFile, type WorkflowFile } from "@ai-agent-workflow/workflow-domain";
import { prisma } from "../db/prisma";
import { logger } from "../logger";

/**
 * User-scoped persistence for workflows. The production implementation is
 * Prisma-backed; tests inject an in-memory fake (see createInMemoryWorkflowRepository).
 */
export type WorkflowRepository = {
  list(userId: string): Promise<WorkflowDto[]>;
  get(userId: string, id: string): Promise<WorkflowDto | null>;
  create(userId: string, workflow: WorkflowFile): Promise<WorkflowDto>;
  update(userId: string, id: string, workflow: WorkflowFile): Promise<WorkflowDto | null>;
  delete(userId: string, id: string): Promise<boolean>;
};

type WorkflowRow = {
  id: string;
  document: unknown;
};

/**
 * Normalizes a stored document through `WorkflowFileSchema` so legacy/partial
 * payloads gain their defaults and migrations on load — most importantly the LLM
 * `messages[]` migration from the old `{ systemPrompt, userPrompt }` shape, and the
 * `metadata.mode` / `settings.memory` defaults. Without this the raw document runs
 * as-is and an LLM node missing `config.messages` throws `reading 'map'`. On a
 * genuinely invalid document we fall back to the raw value (and warn) rather than
 * failing the load.
 */
export function normalizeStoredWorkflow(id: string, document: unknown): WorkflowFile {
  const parsed = validateWorkflowFile(document);
  if (parsed.ok) {
    return parsed.data;
  }
  logger.warn("workflow.document.invalid_on_load", { id, error: parsed.error });
  return document as WorkflowFile;
}

function toDto(row: WorkflowRow): WorkflowDto {
  return { id: row.id, workflow: normalizeStoredWorkflow(row.id, row.document) };
}

export function createPrismaWorkflowRepository(): WorkflowRepository {
  return {
    async list(userId) {
      const rows = await prisma.workflow.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        select: { id: true, document: true },
      });
      return rows.map(toDto);
    },

    async get(userId, id) {
      const row = await prisma.workflow.findFirst({
        where: { id, userId },
        select: { id: true, document: true },
      });
      return row ? toDto(row) : null;
    },

    async create(userId, workflow) {
      const row = await prisma.workflow.create({
        data: {
          userId,
          name: workflow.metadata.name,
          document: workflow as object,
        },
        select: { id: true, document: true },
      });
      return toDto(row);
    },

    async update(userId, id, workflow) {
      // Scope by userId so a non-owned id updates 0 rows.
      const result = await prisma.workflow.updateMany({
        where: { id, userId },
        data: { name: workflow.metadata.name, document: workflow as object },
      });
      if (result.count === 0) {
        return null;
      }
      return { id, workflow };
    },

    async delete(userId, id) {
      const result = await prisma.workflow.deleteMany({ where: { id, userId } });
      return result.count > 0;
    },
  };
}

/** Seeds a default workflow for a freshly created user. */
export async function seedDefaultWorkflow(userId: string): Promise<void> {
  const workflow = createDefaultWorkflow();
  await prisma.workflow.create({
    data: { userId, name: workflow.metadata.name, document: workflow as object },
  });
}

/** In-memory repository for tests. Optionally seeded with one workflow. */
export function createInMemoryWorkflowRepository(seed?: {
  id: string;
  userId: string;
  workflow: WorkflowFile;
}): WorkflowRepository {
  const store = new Map<string, { userId: string; workflow: WorkflowFile }>();
  let counter = 1;
  if (seed) {
    store.set(seed.id, { userId: seed.userId, workflow: seed.workflow });
  }

  return {
    async list(userId) {
      return [...store.entries()]
        .filter(([, value]) => value.userId === userId)
        .map(([id, value]) => ({ id, workflow: normalizeStoredWorkflow(id, value.workflow) }));
    },
    async get(userId, id) {
      const entry = store.get(id);
      return entry && entry.userId === userId
        ? { id, workflow: normalizeStoredWorkflow(id, entry.workflow) }
        : null;
    },
    async create(userId, workflow) {
      const id = `workflow-${++counter}`;
      store.set(id, { userId, workflow });
      return { id, workflow };
    },
    async update(userId, id, workflow) {
      const entry = store.get(id);
      if (!entry || entry.userId !== userId) {
        return null;
      }
      store.set(id, { userId, workflow });
      return { id, workflow };
    },
    async delete(userId, id) {
      const entry = store.get(id);
      if (!entry || entry.userId !== userId) {
        return false;
      }
      store.delete(id);
      return true;
    },
  };
}
