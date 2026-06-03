import type { RunInput } from "@ai-agent-workflow/api-contracts";
import type { StartNode } from "@ai-agent-workflow/workflow-domain";
import { RuntimeValidationError } from "./errors";

export function materializeStartValues(startNode: StartNode, input: RunInput): Record<string, unknown> {
  const values: Record<string, unknown> = {};

  for (const field of startNode.config.fields) {
    const provided = input[field.name];
    if (provided !== undefined) {
      values[field.name] = provided;
      continue;
    }

    if (field.defaultValue !== undefined) {
      values[field.name] = field.defaultValue;
      continue;
    }

    if (field.required) {
      throw new RuntimeValidationError(`Missing required Start field "${field.name}".`);
    }

    values[field.name] = null;
  }

  return values;
}
