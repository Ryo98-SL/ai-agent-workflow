const VARIABLE_TAG_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}/g;
const NODE_ID_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;
const PATH_SEGMENT_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export type WorkflowRuntimeState = Record<string, Record<string, unknown>>;

export type PromptVariableReference =
  | {
      ok: true;
      value: string;
      nodeId: string;
      path: string[];
    }
  | {
      ok: false;
      value: string;
      error: string;
    };

export type PromptResolution =
  | { ok: true; text: string; variables: string[] }
  | { ok: false; missingVariables: string[]; variables: string[] };

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

export function parsePromptVariableReferences(prompt: string): PromptVariableReference[] {
  const references = new Map<string, PromptVariableReference>();

  for (const match of prompt.matchAll(VARIABLE_TAG_PATTERN)) {
    const value = match[1].trim();
    if (references.has(value)) {
      continue;
    }

    const parts = value.split(".");
    const [nodeId, ...path] = parts;
    if (!nodeId || path.length === 0) {
      references.set(value, {
        ok: false,
        value,
        error: "Use namespaced variables like {{start1.topic}}.",
      });
      continue;
    }

    if (!NODE_ID_PATTERN.test(nodeId) || path.some((segment) => !PATH_SEGMENT_PATTERN.test(segment))) {
      references.set(value, {
        ok: false,
        value,
        error: "Variable references must use a valid node id and field path.",
      });
      continue;
    }

    references.set(value, { ok: true, value, nodeId, path });
  }

  return [...references.values()].sort((left, right) => left.value.localeCompare(right.value));
}

export function parsePromptVariables(prompt: string): string[] {
  return uniqueSorted(parsePromptVariableReferences(prompt).map((reference) => reference.value));
}

function stringifyPromptValue(value: unknown): string {
  if (value === null) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }

  return JSON.stringify(value);
}

export function readRuntimeStateValue(state: WorkflowRuntimeState, reference: PromptVariableReference): unknown {
  if (!reference.ok) {
    return undefined;
  }

  let current: unknown = state[reference.nodeId];
  for (const segment of reference.path) {
    if (current === null || typeof current !== "object" || !(segment in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

export function resolvePromptWithRuntimeState(prompt: string, state: WorkflowRuntimeState): PromptResolution {
  const references = parsePromptVariableReferences(prompt);
  const missingVariables = references
    .filter((reference) => !reference.ok || readRuntimeStateValue(state, reference) === undefined)
    .map((reference) => reference.value);

  if (missingVariables.length > 0) {
    return { ok: false, missingVariables, variables: references.map((reference) => reference.value) };
  }

  return {
    ok: true,
    variables: references.map((reference) => reference.value),
    text: prompt.replace(VARIABLE_TAG_PATTERN, (_match, value: string) => {
      const reference = references.find((item) => item.value === value.trim());
      return reference ? stringifyPromptValue(readRuntimeStateValue(state, reference)) : "";
    }),
  };
}

export function resolvePromptVariables(prompt: string, values: Record<string, string>): PromptResolution {
  const variables = parsePromptVariables(prompt);
  const missingVariables = variables.filter((variable) => values[variable] === undefined || values[variable] === "");

  if (missingVariables.length > 0) {
    return { ok: false, missingVariables, variables };
  }

  return {
    ok: true,
    variables,
    text: prompt.replace(VARIABLE_TAG_PATTERN, (_match, variable: string) => values[variable.trim()]),
  };
}

export function mergeVariableValues(
  nodeVariables: Record<string, string>,
  testVariables: Record<string, string>,
): Record<string, string> {
  return { ...nodeVariables, ...testVariables };
}
