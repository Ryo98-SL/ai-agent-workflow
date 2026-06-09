import type { WorkflowRun, WorkflowSummary } from "@ai-agent-workflow/api-contracts";
import { createDefaultWorkflow, type WorkflowFile } from "@ai-agent-workflow/workflow-domain";
import { clear, createStore, del, entries, get, set, type UseStore } from "idb-keyval";
import type { WorkbenchWorkflowApi } from "../workbench/types";
import { forgetAnonymousRun, getAnonymousRunIds, recordAnonymousRun } from "./anonymousRunStore";

export type LocalWorkflowRecord = { id: string; workflow: WorkflowFile };

const LEGACY_LOCALSTORAGE_KEY = "workbench.local.workflows.v1";

// Workflows can be large (many nodes + long prompts), so we use IndexedDB
// (per-workflow keys → updating one doesn't rewrite the rest) instead of the
// ~5MB string-only localStorage.
let storeRef: UseStore | null = null;

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function store(): UseStore {
  if (!storeRef) {
    storeRef = createStore("workbench-local", "workflows");
  }
  return storeRef;
}

let migrationDone = false;

/** One-time best-effort migration of legacy localStorage records into IndexedDB. */
async function migrateLegacy(): Promise<void> {
  if (migrationDone || typeof localStorage === "undefined" || !hasIndexedDb()) {
    migrationDone = true;
    return;
  }
  migrationDone = true;
  try {
    const raw = localStorage.getItem(LEGACY_LOCALSTORAGE_KEY);
    if (!raw) {
      return;
    }
    const records = JSON.parse(raw) as LocalWorkflowRecord[];
    if (Array.isArray(records)) {
      for (const record of records) {
        if (record?.id && record.workflow) {
          await set(record.id, record.workflow, store());
        }
      }
    }
  } catch {
    // Ignore malformed legacy data.
  } finally {
    localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY);
  }
}

function touch(workflow: WorkflowFile): WorkflowFile {
  return { ...workflow, metadata: { ...workflow.metadata, updatedAt: new Date().toISOString() } };
}

function summarize(record: LocalWorkflowRecord): WorkflowSummary {
  const { workflow } = record;
  return {
    id: record.id,
    name: workflow.metadata.name,
    description: workflow.metadata.description,
    icon: workflow.metadata.icon,
    updatedAt: workflow.metadata.updatedAt,
    nodeCount: workflow.graph.nodes.length,
    edgeCount: workflow.graph.edges.length,
  };
}

function newId(): string {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return `local-${uuid}`;
}

async function readRecords(): Promise<LocalWorkflowRecord[]> {
  if (!hasIndexedDb()) {
    return [];
  }
  await migrateLegacy();
  const pairs = await entries<string, WorkflowFile>(store());
  return pairs
    .map(([id, workflow]) => ({ id, workflow }))
    .sort((a, b) => (b.workflow.metadata.updatedAt ?? "").localeCompare(a.workflow.metadata.updatedAt ?? ""));
}

/** Reads all locally-stored workflows (used by the import-on-login flow). */
export async function readLocalWorkflows(): Promise<LocalWorkflowRecord[]> {
  return readRecords();
}

/** Deletes a single local workflow (used by import to drain successes). */
export async function deleteLocalWorkflow(id: string): Promise<void> {
  if (hasIndexedDb()) {
    await del(id, store());
  }
}

/** Clears the entire local workflow store (after a successful import). */
export async function clearLocalWorkflows(): Promise<void> {
  if (hasIndexedDb()) {
    await clear(store());
  }
}

/**
 * Anonymous workflow API: workflow CRUD is backed by IndexedDB, while run
 * execution still goes to the server (with the workflow sent inline, since the
 * server has no copy). Run reads and account endpoints delegate to the server.
 */
export function createLocalWorkflowApi(serverApi: WorkbenchWorkflowApi): WorkbenchWorkflowApi {
  return {
    async listWorkflows() {
      return { workflows: (await readRecords()).map(summarize) };
    },

    async getWorkflow(id) {
      const workflow = hasIndexedDb() ? await get<WorkflowFile>(id, store()) : undefined;
      if (!workflow) {
        throw new Error(`Local workflow ${id} was not found.`);
      }
      return { workflow: { id, workflow } };
    },

    async createWorkflow(request) {
      // Never persist an empty workflow — fall back to a valid default.
      const workflow = touch(request?.workflow ?? createDefaultWorkflow());
      const id = newId();
      if (hasIndexedDb()) {
        await set(id, workflow, store());
      }
      return { workflow: { id, workflow } };
    },

    async updateWorkflow(id, request) {
      const workflow = touch(request.workflow);
      if (hasIndexedDb()) {
        await set(id, workflow, store());
      }
      return { workflow: { id, workflow } };
    },

    async deleteWorkflow(id) {
      await deleteLocalWorkflow(id);
    },

    // Run execution is server-owned; send the local workflow inline.
    async createRun(workflowId, request) {
      const workflow = hasIndexedDb() ? await get<WorkflowFile>(workflowId, store()) : undefined;
      const result = await serverApi.createRun(workflowId, { ...(request ?? { input: {} }), workflow });
      // Track the run id for a session-scoped history (runs live in server memory).
      recordAnonymousRun(workflowId, result.run.id);
      return result;
    },
    getRun: (id) => serverApi.getRun(id),
    listRunEvents: (id) => serverApi.listRunEvents(id),
    runStreamUrl: (id) => serverApi.runStreamUrl(id),
    resumeRun: (id, request) => serverApi.resumeRun(id, request),
    async deleteRun(runId) {
      for (const record of await readRecords()) {
        forgetAnonymousRun(record.id, runId);
      }
    },
    // Session-scoped anonymous history: resolve tracked run ids from server
    // memory; ids that were evicted (TTL) are dropped.
    async listWorkflowRuns(workflowId) {
      const ids = getAnonymousRunIds(workflowId);
      const runs: WorkflowRun[] = [];
      for (const id of ids) {
        try {
          const { run } = await serverApi.getRun(id);
          runs.push(run);
        } catch {
          // Run no longer in server memory.
        }
      }
      return { runs };
    },

    // Knowledge Bases are server-owned even for anonymous users. Anonymous users
    // can read the seeded example KB; mutations delegate and receive the
    // server's normalized unauthorized response.
    listKnowledgeBases: () => serverApi.listKnowledgeBases(),
    createKnowledgeBase: (request) => serverApi.createKnowledgeBase(request),
    getKnowledgeBase: (id) => serverApi.getKnowledgeBase(id),
    updateKnowledgeBase: (id, request) => serverApi.updateKnowledgeBase(id, request),
    deleteKnowledgeBase: (id) => serverApi.deleteKnowledgeBase(id),
    listKnowledgeBaseDocuments: (knowledgeBaseId) => serverApi.listKnowledgeBaseDocuments(knowledgeBaseId),
    createTextKnowledgeDocument: (knowledgeBaseId, request) =>
      serverApi.createTextKnowledgeDocument(knowledgeBaseId, request),
    createFileKnowledgeDocument: (knowledgeBaseId, request) =>
      serverApi.createFileKnowledgeDocument(knowledgeBaseId, request),
    deleteKnowledgeDocument: (id) => serverApi.deleteKnowledgeDocument(id),
    reindexKnowledgeDocument: (id) => serverApi.reindexKnowledgeDocument(id),

    // Account endpoints are not used in anonymous mode; delegate for type parity.
    listProviderKeys: () => serverApi.listProviderKeys(),
    createProviderKey: (request) => serverApi.createProviderKey(request),
    deleteProviderKey: (id) => serverApi.deleteProviderKey(id),
    listCustomModels: () => serverApi.listCustomModels(),
    createCustomModel: (request) => serverApi.createCustomModel(request),
    deleteCustomModel: (id) => serverApi.deleteCustomModel(id),
    getCredits: () => serverApi.getCredits(),
    applyCredits: () => serverApi.applyCredits(),
  };
}
