import type { WorkflowFile } from "@ai-agent-workflow/workflow-domain";

export function workflowDirtySnapshot(workflow: WorkflowFile): string {
  const modelProvider = workflow.settings.modelProvider ? { ...workflow.settings.modelProvider } : undefined;
  if (modelProvider) {
    delete modelProvider.apiKey;
  }

  return stableStringify({
    version: workflow.version,
    graph: workflow.graph,
    settings: {
      ...workflow.settings,
      modelProvider,
    },
  });
}

function stableStringify(value: unknown): string {
  return JSON.stringify(toStableValue(value));
}

function toStableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(toStableValue);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const sortedEntries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([entryKey, entryValue]) => [entryKey, toStableValue(entryValue)]);

  return Object.fromEntries(sortedEntries);
}
