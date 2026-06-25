import type { JsonValue, ToolDescriptor } from "@ai-agent-workflow/workflow-domain";

/** Safety-critical author-fixed defaults for a newly selected Agent tool. */
export function initialAgentToolParams(descriptor: ToolDescriptor): Record<string, JsonValue> {
  return descriptor.provider === "builtin" && descriptor.toolName === "emailSend" ? { send: false } : {};
}
