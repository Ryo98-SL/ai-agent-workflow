import type { ToolNode } from "@ai-agent-workflow/workflow-domain";
import type { RuntimeAdapterContext, RuntimeResult, ToolRuntimeAdapter } from "./types";

export const currentTimeToolAdapter: ToolRuntimeAdapter = {
  id: "current-time",
  label: "Current Time",
  executable: true,
  execute: executeCurrentTimeTool,
};

export async function executeCurrentTimeTool(
  node: ToolNode,
  _context: RuntimeAdapterContext,
): Promise<RuntimeResult> {
  void _context;
  const started = performance.now();
  const startedAt = new Date().toISOString();
  // Legacy/dead adapter (see ADR 0003): read the timezone from the generic tool
  // params shape so this unused module still compiles. Full removal is deferred.
  const timezone = (typeof node.config.params.timezone === "string" ? node.config.params.timezone : undefined) || "UTC";

  try {
    const now = new Date();
    const responseText = new Intl.DateTimeFormat("en-US", {
      dateStyle: "full",
      timeStyle: "long",
      timeZone: timezone,
    }).format(now);

    return {
      nodeId: node.id,
      nodeType: "tool",
      adapter: currentTimeToolAdapter.id,
      status: "success",
      startedAt,
      completedAt: new Date().toISOString(),
      latencyMs: Math.max(0, Math.round(performance.now() - started)),
      request: {
        body: { adapter: "currentTime", timezone },
      },
      responseText,
      rawResponseSummary: JSON.stringify({ iso: now.toISOString(), timezone, formatted: responseText }, null, 2),
    };
  } catch (error) {
    return {
      nodeId: node.id,
      nodeType: "tool",
      adapter: currentTimeToolAdapter.id,
      status: "error",
      startedAt,
      completedAt: new Date().toISOString(),
      latencyMs: Math.max(0, Math.round(performance.now() - started)),
      error: {
        code: "tool_failed",
        message: (error as Error).message,
      },
    };
  }
}
