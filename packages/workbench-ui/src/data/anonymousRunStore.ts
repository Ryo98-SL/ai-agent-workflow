/**
 * Tracks run ids created while anonymous, so the run-history menu can show a
 * session-scoped history. The runs themselves live in server memory (ephemeral,
 * ~10min TTL); we only keep their ids here. Backed by sessionStorage so a tab
 * reload keeps the list, but it is gone when the tab closes — anonymous runs are
 * never durable (sign in for that).
 */
const KEY = "workbench.anonymous-run-ids.v1";
const MAX_PER_WORKFLOW = 25;

type Store = Record<string, string[]>; // workflowId -> runIds (most recent first)

function read(): Store {
  if (typeof sessionStorage === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function write(store: Store): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // Ignore quota/serialization errors.
  }
}

export function recordAnonymousRun(workflowId: string, runId: string): void {
  const store = read();
  const list = [runId, ...(store[workflowId] ?? []).filter((id) => id !== runId)].slice(0, MAX_PER_WORKFLOW);
  store[workflowId] = list;
  write(store);
}

export function getAnonymousRunIds(workflowId: string): string[] {
  return read()[workflowId] ?? [];
}

export function forgetAnonymousRun(workflowId: string, runId: string): void {
  const store = read();
  const next = (store[workflowId] ?? []).filter((id) => id !== runId);
  if (next.length > 0) {
    store[workflowId] = next;
  } else {
    delete store[workflowId];
  }
  write(store);
}
