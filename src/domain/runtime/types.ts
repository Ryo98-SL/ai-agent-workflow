import type { LLMNode, OpenAICompatibleSettings, ToolNode, WorkflowNode } from "../workflow/schema";

export type RuntimeStatus = "idle" | "running" | "success" | "error";

export type RuntimeError = {
  message: string;
  code?: string;
  detail?: string;
};

export type RuntimeRequestSummary = {
  url?: string;
  method?: string;
  model?: string;
  messages?: Array<{ role: "system" | "user"; content: string }>;
  body?: Record<string, unknown>;
};

export type RuntimeResult = {
  nodeId: string;
  nodeType: WorkflowNode["type"];
  adapter: string;
  status: Exclude<RuntimeStatus, "idle" | "running">;
  startedAt: string;
  completedAt: string;
  latencyMs: number;
  resolvedPrompt?: {
    system?: string;
    user?: string;
    variables: Record<string, string>;
  };
  request?: RuntimeRequestSummary;
  responseText?: string;
  rawResponseSummary?: string;
  error?: RuntimeError;
};

export type RuntimeAdapterContext = {
  modelProvider?: OpenAICompatibleSettings;
  testVariables: Record<string, string>;
  signal?: AbortSignal;
};

export type NodeRuntimeAdapter<Node extends WorkflowNode = WorkflowNode> = {
  id: string;
  label: string;
  executable: boolean;
  execute: (node: Node, context: RuntimeAdapterContext) => Promise<RuntimeResult>;
};

export type LLMRuntimeAdapter = NodeRuntimeAdapter<LLMNode>;
export type ToolRuntimeAdapter = NodeRuntimeAdapter<ToolNode>;
