const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.-]*)\s*\}\}/g;

export type PromptResolution =
  | { ok: true; text: string; variables: string[] }
  | { ok: false; missingVariables: string[]; variables: string[] };

export function parsePromptVariables(prompt: string): string[] {
  const variables = new Set<string>();
  for (const match of prompt.matchAll(VARIABLE_PATTERN)) {
    variables.add(match[1]);
  }
  return [...variables].sort();
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
    text: prompt.replace(VARIABLE_PATTERN, (_match, variable: string) => values[variable]),
  };
}

export function mergeVariableValues(
  nodeVariables: Record<string, string>,
  testVariables: Record<string, string>,
): Record<string, string> {
  return { ...nodeVariables, ...testVariables };
}
