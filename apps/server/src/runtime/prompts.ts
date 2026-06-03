import {
  resolvePromptWithRuntimeState,
  type WorkflowRuntimeState,
} from "@ai-agent-workflow/workflow-domain";
import { RuntimeValidationError } from "./errors";

export function resolvePrompt(prompt: string, state: WorkflowRuntimeState): string {
  const resolution = resolvePromptWithRuntimeState(prompt, state);
  if (!resolution.ok) {
    throw new RuntimeValidationError(`Missing prompt variable values: ${resolution.missingVariables.join(", ")}.`);
  }

  return resolution.text;
}
