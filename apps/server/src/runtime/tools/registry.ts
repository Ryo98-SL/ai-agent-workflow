import { toolDescriptorKey } from "@ai-agent-workflow/workflow-domain";
import { currentTimeRuntime } from "./currentTime";
import { emailSendRuntime } from "./emailSend";
import type { ToolRuntime } from "./types";

/** Built-in tool runtimes, keyed by their `provider:providerId:toolName` identity. */
const BUILTIN_TOOL_RUNTIMES: ToolRuntime[] = [currentTimeRuntime, emailSendRuntime];

const byKey = new Map(
  BUILTIN_TOOL_RUNTIMES.map((runtime) => [
    toolDescriptorKey(runtime.provider, runtime.providerId, runtime.toolName),
    runtime,
  ]),
);

/** Resolves the server runtime for a Tool node's bound identity, if any. */
export function resolveToolRuntime(provider: string, providerId: string, toolName: string): ToolRuntime | undefined {
  return byKey.get(toolDescriptorKey(provider, providerId, toolName));
}

export type { ToolRuntime, ToolRuntimeContext, ToolRunResult } from "./types";
