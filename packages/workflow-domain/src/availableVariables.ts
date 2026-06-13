import {
  USER_INPUT_FIELDS,
  USER_INPUT_LABEL,
  USER_INPUT_NAMESPACE,
  type WorkflowEdge,
  type WorkflowNode,
  type WorkflowNodeOutputField,
  type WorkflowNodeType,
} from "./schema";
import { nodeOutputFields } from "./toolRegistry";

/**
 * A single field a node may reference, flattened to a runtime-resolvable path.
 * `selectable: false` marks a structural header (e.g. an array-of-object output
 * like `knowledge1.result`) that cannot be inserted as a scalar reference.
 */
export type AvailableVariableField = {
  nodeId: string;
  /** Path segments after the node id, e.g. `["text"]` or `["result", "content"]`. */
  path: string[];
  /** Leaf display name (the last path segment). */
  name: string;
  /** Output type label, e.g. `"string"`, `"Number"`, `"Array[Object]"`. */
  type: string;
  description?: string;
  /** Canonical `{{nodeId.path}}` reference string. */
  reference: string;
  /** False for array-of-object headers that can't resolve to a scalar today. */
  selectable: boolean;
};

/** Available variables contributed by one upstream (ancestor) node. */
export type AvailableVariableGroup = {
  nodeId: string;
  nodeType: WorkflowNodeType;
  nodeLabel: string;
  fields: AvailableVariableField[];
  /**
   * True for the synthetic `userInput` Ambient Variable group (Chat Mode), which
   * has no producing node. UI renders it with a dedicated icon and never flags its
   * chips as unavailable; `nodeType` is a placeholder for ambient groups.
   */
  ambient?: boolean;
};

/** Options controlling which Ambient Variables are surfaced. */
export type AvailableVariablesOptions = {
  /** When true, prepend the `userInput` ambient namespace group (Chat Mode). */
  chatMode?: boolean;
};

/** Builds the synthetic `userInput` ambient group (Chat Mode only). */
function buildUserInputGroup(): AvailableVariableGroup {
  return {
    nodeId: USER_INPUT_NAMESPACE,
    // Placeholder: ambient groups render via a dedicated icon, not nodeType.
    nodeType: "start",
    nodeLabel: USER_INPUT_LABEL,
    ambient: true,
    fields: USER_INPUT_FIELDS.map((field) => ({
      nodeId: USER_INPUT_NAMESPACE,
      path: [field.name],
      name: field.name,
      type: field.type,
      description: field.description,
      reference: formatVariableReference(USER_INPUT_NAMESPACE, [field.name]),
      // Array-typed fields (e.g. files) can't resolve to a scalar reference yet.
      selectable: !field.type.startsWith("Array"),
    })),
  };
}

/** Formats a node id + path into the canonical `{{nodeId.path}}` reference. */
export function formatVariableReference(nodeId: string, path: string[]): string {
  return `{{${[nodeId, ...path].join(".")}}}`;
}

const SINGLE_REFERENCE_PATTERN = /^\s*\{\{\s*([^{}]+?)\s*\}\}\s*$/;
const NODE_ID_SEGMENT = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;
const PATH_SEGMENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export type ParsedVariableReference =
  | { ok: true; nodeId: string; path: string[] }
  | { ok: false };

/**
 * Parses a value that holds a *single* variable reference — either the wrapped
 * `{{nodeId.path}}` form (as stored by If/Else conditions) or the bare
 * `nodeId.path` form. Returns `{ ok: false }` for anything malformed.
 */
export function parseVariableReference(raw: string): ParsedVariableReference {
  const wrapped = raw.match(SINGLE_REFERENCE_PATTERN);
  const inner = (wrapped ? wrapped[1] : raw).trim();
  if (!inner) {
    return { ok: false };
  }

  const [nodeId, ...path] = inner.split(".");
  if (!nodeId || path.length === 0) {
    return { ok: false };
  }
  if (!NODE_ID_SEGMENT.test(nodeId) || path.some((segment) => !PATH_SEGMENT.test(segment))) {
    return { ok: false };
  }

  return { ok: true, nodeId, path };
}

/** Reverse-BFS: every node that can reach `nodeId` by following edges forward. */
function connectedAncestorIds(edges: WorkflowEdge[], nodeId: string): Set<string> {
  const incoming = new Map<string, string[]>();
  for (const edge of edges) {
    const sources = incoming.get(edge.target) ?? [];
    sources.push(edge.source);
    incoming.set(edge.target, sources);
  }

  const ancestors = new Set<string>();
  const queue = [...(incoming.get(nodeId) ?? [])];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === nodeId || ancestors.has(current)) {
      continue;
    }
    ancestors.add(current);
    queue.push(...(incoming.get(current) ?? []));
  }
  return ancestors;
}

/**
 * Kahn topological order over all nodes (forward edges). Upstream-most nodes come
 * first. Nodes caught in a cycle are appended in their original array order so the
 * function never drops a node.
 */
function topologicalOrder(nodes: WorkflowNode[], edges: WorkflowEdge[]): string[] {
  const indegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  for (const node of nodes) {
    indegree.set(node.id, 0);
  }
  for (const edge of edges) {
    if (!indegree.has(edge.target) || !indegree.has(edge.source)) {
      continue;
    }
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
    const targets = outgoing.get(edge.source) ?? [];
    targets.push(edge.target);
    outgoing.set(edge.source, targets);
  }

  const ordered: string[] = [];
  const ready = nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0).map((node) => node.id);
  const seen = new Set<string>();
  while (ready.length > 0) {
    const current = ready.shift()!;
    if (seen.has(current)) {
      continue;
    }
    seen.add(current);
    ordered.push(current);
    for (const next of outgoing.get(current) ?? []) {
      indegree.set(next, (indegree.get(next) ?? 0) - 1);
      if ((indegree.get(next) ?? 0) <= 0) {
        ready.push(next);
      }
    }
  }
  for (const node of nodes) {
    if (!seen.has(node.id)) {
      ordered.push(node.id);
    }
  }
  return ordered;
}

/** Flattens a node's output field tree into runtime-resolvable scalar references. */
function fieldsForNode(node: WorkflowNode): AvailableVariableField[] {
  if (node.type === "start") {
    return node.config.fields.map((field) => ({
      nodeId: node.id,
      path: [field.name],
      name: field.name,
      type: "string",
      description: field.label,
      reference: formatVariableReference(node.id, [field.name]),
      selectable: true,
    }));
  }

  const result: AvailableVariableField[] = [];
  const walk = (field: WorkflowNodeOutputField, prefix: string[]) => {
    const path = [...prefix, field.name];
    const isArray = field.type.startsWith("Array");
    const hasChildren = Boolean(field.children?.length);

    if (isArray) {
      // Array-of-object outputs (e.g. knowledge.result) can't resolve to a scalar
      // via `{{node.result.content}}` today — surface as a non-selectable header.
      result.push({
        nodeId: node.id,
        path,
        name: field.name,
        type: field.type,
        description: field.description,
        reference: formatVariableReference(node.id, path),
        selectable: false,
      });
      return;
    }

    if (hasChildren) {
      result.push({
        nodeId: node.id,
        path,
        name: field.name,
        type: field.type,
        description: field.description,
        reference: formatVariableReference(node.id, path),
        selectable: false,
      });
      for (const child of field.children ?? []) {
        walk(child, path);
      }
      return;
    }

    result.push({
      nodeId: node.id,
      path,
      name: field.name,
      type: field.type,
      description: field.description,
      reference: formatVariableReference(node.id, path),
      selectable: true,
    });
  };

  for (const field of nodeOutputFields(node)) {
    walk(field, []);
  }
  return result;
}

/**
 * Computes the variable references a node may legally use: the outputs of its
 * connected ancestors (transitive reverse-edge reachability), grouped by
 * producing node in topological order. Disconnected nodes never appear.
 */
export function getAvailableVariables(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  nodeId: string,
  options: AvailableVariablesOptions = {},
): AvailableVariableGroup[] {
  const ancestorIds = connectedAncestorIds(edges, nodeId);
  const byId = new Map(nodes.map((node) => [node.id, node] as const));
  const order = topologicalOrder(nodes, edges);

  // Ambient `userInput` namespace is available to every node (no ancestry).
  const groups: AvailableVariableGroup[] = options.chatMode ? [buildUserInputGroup()] : [];
  for (const id of order) {
    if (!ancestorIds.has(id)) {
      continue;
    }
    const node = byId.get(id);
    if (!node) {
      continue;
    }
    const fields = fieldsForNode(node);
    if (fields.length === 0) {
      continue;
    }
    groups.push({ nodeId: node.id, nodeType: node.type, nodeLabel: node.label, fields });
  }
  return groups;
}

/**
 * Looks up whether a `{{nodeId.path}}` reference is currently resolvable for the
 * node at `nodeId` — i.e. it points at a connected ancestor's selectable field.
 * Returns the matching field when valid. Powers error-state tags and validation.
 */
export function resolveAvailableVariable(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  consumerNodeId: string,
  reference: string,
  options: AvailableVariablesOptions = {},
): AvailableVariableField | undefined {
  const parsed = parseVariableReference(reference);
  if (!parsed.ok) {
    return undefined;
  }
  const groups = getAvailableVariables(nodes, edges, consumerNodeId, options);
  const target = formatVariableReference(parsed.nodeId, parsed.path);
  for (const group of groups) {
    const match = group.fields.find((field) => field.reference === target && field.selectable);
    if (match) {
      return match;
    }
  }
  return undefined;
}
