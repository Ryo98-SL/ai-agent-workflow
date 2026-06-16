import {
  createAgentToolsDemoWorkflow,
  createDefaultWorkflow,
  createKnowledgeDemoWorkflow,
  createSupportAgentWorkflow,
  createSupportBotWithReviewWorkflow,
  type WorkflowFile,
} from "./schema";

/** What a template needs to actually run, surfaced as a badge in the picker. */
export type WorkflowTemplateRequirement = "credits" | "auth";

export type WorkflowTemplate = {
  /** Stable id. */
  id: string;
  name: string;
  /** One-line description shown on the picker card. */
  description: string;
  /** lucide icon key (same scheme as workflow metadata.icon). */
  icon: string;
  /** Capability tags, e.g. ["RAG", "分支", "人工复核", "记忆"]. */
  tags: string[];
  /** Empty = anyone can run; ["credits"] = needs sign-in + AI credits (or a key). */
  requires: WorkflowTemplateRequirement[];
  /** Curated node-flow summary shown in the picker preview. */
  flow: string[];
  /** Produces a fresh, unsaved WorkflowFile (timestamps set to now). */
  build: () => WorkflowFile;
};

/**
 * Code-defined registry of starter workflows shown in the "New workflow" picker.
 * Every entry is a real, runnable workflow; `build()` output is kept valid by
 * the schema and the template test suite so examples never drift from the nodes.
 */
export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "blank",
    name: "从空白开始",
    description: "一个 Start → LLM 的最小工作流，从零搭建。",
    icon: "plus",
    tags: [],
    requires: [],
    flow: ["Start", "LLM"],
    build: createDefaultWorkflow,
  },
  {
    id: "support-rag",
    name: "云舵客服 RAG",
    description: "基于示例知识库的中文客服问答：问题经知识检索后再生成回答。",
    icon: "bot",
    tags: ["RAG"],
    requires: ["credits"],
    flow: ["Start", "Knowledge", "LLM"],
    build: createKnowledgeDemoWorkflow,
  },
  {
    id: "support-hitl",
    name: "客服机器人（含人工复核）",
    description: "退款/投诉类问题自动转人工复核，其余自动回复；基于示例知识库，带对话记忆。",
    icon: "userCheck",
    tags: ["RAG", "分支", "人工复核", "记忆"],
    requires: ["credits"],
    flow: ["Start", "Knowledge", "LLM", "If/Else", "人工复核 / 自动回复"],
    build: createSupportBotWithReviewWorkflow,
  },
  {
    id: "agent-tools-demo",
    name: "Agent 工具调度演示",
    description: "Agent 在一个节点内同时使用内置工具和 Built-in MCP 工具，完成工具选择与回答。",
    icon: "bot",
    tags: ["Agent", "Tool", "MCP"],
    requires: ["credits"],
    flow: ["Start", "Agent", "End"],
    build: createAgentToolsDemoWorkflow,
  },
  {
    id: "support-agent",
    name: "客服 Agent（工具 + MCP）",
    description: "基于示例知识库检索客户问题，再由 Agent 调用内置工具和 Built-in MCP 工具生成回复。",
    icon: "bot",
    tags: ["RAG", "Agent", "Tool", "MCP", "记忆"],
    requires: ["credits"],
    flow: ["Start", "Knowledge", "Agent", "End"],
    build: createSupportAgentWorkflow,
  },
];

export function getWorkflowTemplate(id: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find((template) => template.id === id);
}
