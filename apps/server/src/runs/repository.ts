import type { RunEvent, WorkflowRun } from "@ai-agent-workflow/api-contracts";
import { prisma } from "../db/prisma";

/**
 * Durable persistence for authenticated users' runs. Anonymous runs are never
 * passed here (they live only in memory). The production implementation is
 * Prisma-backed; tests inject an in-memory fake.
 */
export type RunRepository = {
  create(userId: string, run: WorkflowRun, workflowId: string | null): Promise<void>;
  complete(userId: string, run: WorkflowRun, events: RunEvent[]): Promise<void>;
  get(userId: string, runId: string): Promise<WorkflowRun | null>;
  listEvents(userId: string, runId: string): Promise<RunEvent[] | null>;
  listRuns(userId: string, workflowId: string): Promise<WorkflowRun[]>;
  delete(userId: string, runId: string): Promise<boolean>;
};

type RunRow = {
  id: string;
  workflowId: string | null;
  status: string;
  input: unknown;
  output: unknown;
  error: unknown;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
};

type RunJsonInput = Parameters<typeof prisma.run.create>[0]["data"]["input"];
type RunNullableJsonInput = Exclude<NonNullable<Parameters<typeof prisma.run.updateMany>[0]["data"]>["output"], undefined>;
type RunEventRow = Awaited<ReturnType<typeof prisma.runEvent.findMany>>[number];

function toRunDto(row: RunRow): WorkflowRun {
  return {
    id: row.id,
    workflowId: row.workflowId ?? "",
    status: row.status as WorkflowRun["status"],
    input: row.input as WorkflowRun["input"],
    output: (row.output as WorkflowRun["output"]) ?? null,
    error: (row.error as WorkflowRun["error"]) ?? null,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  };
}

const json = (value: unknown): RunJsonInput => (value ?? null) as RunJsonInput;
const nullableJson = (value: unknown): RunNullableJsonInput => (value ?? null) as RunNullableJsonInput;

export function createPrismaRunRepository(): RunRepository {
  return {
    async create(userId, run, workflowId) {
      await prisma.run.create({
        data: {
          id: run.id,
          userId,
          workflowId, // null when the run used an inline/unsaved workflow
          status: run.status,
          input: json(run.input),
          createdAt: new Date(run.createdAt),
          startedAt: run.startedAt ? new Date(run.startedAt) : null,
        },
      });
    },

    async complete(userId, run, events) {
      await prisma.$transaction([
        prisma.run.updateMany({
          where: { id: run.id, userId },
          data: {
            status: run.status,
            output: nullableJson(run.output),
            error: nullableJson(run.error),
            completedAt: run.completedAt ? new Date(run.completedAt) : new Date(),
          },
        }),
        prisma.runEvent.createMany({
          data: events.map((event) => ({
            id: event.id,
            runId: run.id,
            sequence: event.sequence,
            type: event.type,
            message: event.message,
            payload: event.payload ? nullableJson(event.payload) : undefined,
            createdAt: new Date(event.createdAt),
          })),
          skipDuplicates: true,
        }),
      ]);
    },

    async get(userId, runId) {
      const row = await prisma.run.findFirst({ where: { id: runId, userId } });
      return row ? toRunDto(row) : null;
    },

    async listEvents(userId, runId) {
      const run = await prisma.run.findFirst({ where: { id: runId, userId }, select: { id: true } });
      if (!run) {
        return null;
      }
      const rows = await prisma.runEvent.findMany({ where: { runId }, orderBy: { sequence: "asc" } });
      return rows.map((row: RunEventRow) => ({
        id: row.id,
        runId: row.runId,
        sequence: row.sequence,
        type: row.type as RunEvent["type"],
        message: row.message,
        createdAt: row.createdAt.toISOString(),
        ...(row.payload ? { payload: row.payload as Record<string, unknown> } : {}),
      }));
    },

    async listRuns(userId, workflowId) {
      const rows = await prisma.run.findMany({
        where: { userId, workflowId },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      return rows.map(toRunDto);
    },

    async delete(userId, runId) {
      const result = await prisma.run.deleteMany({ where: { id: runId, userId } });
      return result.count > 0;
    },
  };
}

/** In-memory run repository for tests. */
export function createInMemoryRunRepository(): RunRepository {
  const runs = new Map<string, { userId: string; run: WorkflowRun; events: RunEvent[] }>();
  return {
    async create(userId, run) {
      runs.set(run.id, { userId, run, events: [] });
    },
    async complete(userId, run, events) {
      runs.set(run.id, { userId, run, events });
    },
    async get(userId, runId) {
      const entry = runs.get(runId);
      return entry && entry.userId === userId ? entry.run : null;
    },
    async listEvents(userId, runId) {
      const entry = runs.get(runId);
      return entry && entry.userId === userId ? entry.events : null;
    },
    async listRuns(userId, workflowId) {
      return [...runs.values()]
        .filter((e) => e.userId === userId && e.run.workflowId === workflowId)
        .map((e) => e.run)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async delete(userId, runId) {
      const entry = runs.get(runId);
      if (!entry || entry.userId !== userId) {
        return false;
      }
      runs.delete(runId);
      return true;
    },
  };
}
