import { DEFAULT_LOCALE, type SupportedLocale } from "@ai-agent-workflow/i18n/locale-contract";
import {
  createAgentToolsDemoWorkflow,
  createDefaultWorkflow,
  createKnowledgeDemoWorkflow,
  createSupportAgentWorkflow,
  createSupportBotWithReviewWorkflow,
  type AgentNode,
  type HumanInputNode,
  type IfElseNode,
  type KnowledgeNode,
  type LLMNode,
  type StartNode,
  type WorkflowFile,
  type WorkflowNode,
} from "./schema";

/** What a template needs to actually run, surfaced as a badge in the picker. */
export type WorkflowTemplateRequirement = "credits" | "auth";

export type WorkflowTemplateId =
  | "blank"
  | "support-rag"
  | "support-hitl"
  | "agent-tools-demo"
  | "support-agent";

export type WorkflowTemplateManifest = {
  id: WorkflowTemplateId;
  icon: string;
  requires: WorkflowTemplateRequirement[];
  buildBase: () => WorkflowFile;
};

export type WorkflowTemplateCopy = {
  name: string;
  description: string;
  tags: string[];
  flow: string[];
};

export type WorkflowTemplate = WorkflowTemplateManifest &
  WorkflowTemplateCopy & {
    /** Produces a fresh, unsaved WorkflowFile (timestamps set to now). */
    build: () => WorkflowFile;
  };

export const WORKFLOW_TEMPLATE_MANIFESTS: WorkflowTemplateManifest[] = [
  { id: "blank", icon: "plus", requires: [], buildBase: createDefaultWorkflow },
  { id: "support-rag", icon: "bot", requires: ["credits"], buildBase: createKnowledgeDemoWorkflow },
  { id: "support-hitl", icon: "userCheck", requires: ["credits"], buildBase: createSupportBotWithReviewWorkflow },
  { id: "agent-tools-demo", icon: "bot", requires: ["credits"], buildBase: createAgentToolsDemoWorkflow },
  { id: "support-agent", icon: "bot", requires: ["credits"], buildBase: createSupportAgentWorkflow },
];

const TEMPLATE_COPY: Record<SupportedLocale, Record<WorkflowTemplateId, WorkflowTemplateCopy>> = {
  "en-US": {
    blank: {
      name: "Blank workflow",
      description: "A minimal Start to LLM workflow for building from scratch.",
      tags: [],
      flow: ["Start", "LLM"],
    },
    "support-rag": {
      name: "Yunduo Support RAG",
      description: "Chinese customer-support Q&A backed by the seeded knowledge base.",
      tags: ["RAG"],
      flow: ["Start", "Knowledge", "LLM"],
    },
    "support-hitl": {
      name: "Support bot with human review",
      description: "Routes refund or complaint questions to human review, with RAG and conversation memory.",
      tags: ["RAG", "Branching", "Human review", "Memory"],
      flow: ["Start", "Knowledge", "LLM", "If/Else", "Human review / auto reply"],
    },
    "agent-tools-demo": {
      name: "Agent tool-routing demo",
      description: "An Agent uses a built-in tool and a Built-in MCP tool inside one node.",
      tags: ["Agent", "Tool", "MCP"],
      flow: ["Start", "Agent", "End"],
    },
    "support-agent": {
      name: "Support Agent with tools + MCP",
      description: "Retrieves support context, then lets an Agent call built-in and Built-in MCP tools.",
      tags: ["RAG", "Agent", "Tool", "MCP", "Memory"],
      flow: ["Start", "Knowledge", "Agent", "End"],
    },
  },
  "zh-CN": {
    blank: {
      name: "从空白开始",
      description: "一个 Start → LLM 的最小工作流，从零搭建。",
      tags: [],
      flow: ["Start", "LLM"],
    },
    "support-rag": {
      name: "云舵客服 RAG",
      description: "基于示例知识库的中文客服问答：问题经知识检索后再生成回答。",
      tags: ["RAG"],
      flow: ["Start", "Knowledge", "LLM"],
    },
    "support-hitl": {
      name: "客服机器人（含人工复核）",
      description: "退款/投诉类问题自动转人工复核，其余自动回复；基于示例知识库，带对话记忆。",
      tags: ["RAG", "分支", "人工复核", "记忆"],
      flow: ["Start", "Knowledge", "LLM", "If/Else", "人工复核 / 自动回复"],
    },
    "agent-tools-demo": {
      name: "Agent 工具调度演示",
      description: "Agent 在一个节点内同时使用内置工具和 Built-in MCP 工具，完成工具选择与回答。",
      tags: ["Agent", "Tool", "MCP"],
      flow: ["Start", "Agent", "End"],
    },
    "support-agent": {
      name: "客服 Agent（工具 + MCP）",
      description: "基于示例知识库检索客户问题，再由 Agent 调用内置工具和 Built-in MCP 工具生成回复。",
      tags: ["RAG", "Agent", "Tool", "MCP", "记忆"],
      flow: ["Start", "Knowledge", "Agent", "End"],
    },
  },
};

export function getWorkflowTemplates(locale: SupportedLocale = DEFAULT_LOCALE): WorkflowTemplate[] {
  return WORKFLOW_TEMPLATE_MANIFESTS.map((manifest) => templateFromManifest(manifest, locale));
}

export function getWorkflowTemplate(id: string, locale: SupportedLocale = DEFAULT_LOCALE): WorkflowTemplate | undefined {
  const manifest = WORKFLOW_TEMPLATE_MANIFESTS.find((template) => template.id === id);
  return manifest ? templateFromManifest(manifest, locale) : undefined;
}

export function buildWorkflowFromTemplate(id: WorkflowTemplateId, locale: SupportedLocale = DEFAULT_LOCALE): WorkflowFile {
  const manifest = WORKFLOW_TEMPLATE_MANIFESTS.find((template) => template.id === id);
  if (!manifest) {
    throw new Error(`Unknown workflow template: ${id}`);
  }
  return applyTemplateWorkflowCopy(id, locale, manifest.buildBase());
}

/**
 * Compatibility export for existing callers. New UI should call
 * `getWorkflowTemplates(locale)` so Template Locale is explicit.
 */
export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = getWorkflowTemplates(DEFAULT_LOCALE);

function templateFromManifest(manifest: WorkflowTemplateManifest, locale: SupportedLocale): WorkflowTemplate {
  const copy = TEMPLATE_COPY[locale][manifest.id];
  return {
    ...manifest,
    ...copy,
    build: () => applyTemplateWorkflowCopy(manifest.id, locale, manifest.buildBase()),
  };
}

function applyTemplateWorkflowCopy(id: WorkflowTemplateId, locale: SupportedLocale, workflow: WorkflowFile): WorkflowFile {
  const copy = TEMPLATE_COPY[locale][id];
  workflow.metadata.name = copy.name;
  workflow.metadata.description = copy.description;
  workflow.metadata.icon = WORKFLOW_TEMPLATE_MANIFESTS.find((manifest) => manifest.id === id)?.icon;

  if (locale === "en-US") {
    applyEnglishWorkflowCopy(id, workflow);
  } else {
    applyChineseWorkflowCopy(id, workflow);
  }

  return workflow;
}

function applyChineseWorkflowCopy(id: WorkflowTemplateId, workflow: WorkflowFile): void {
  if (id !== "blank") {
    return;
  }

  const start = expectNode<StartNode>(workflow, "start1", "start");
  start.label = "开始";
  start.description = "收集本次工作流运行的输入。";
  start.config.fields[0] = { ...start.config.fields[0], label: "主题", defaultValue: "猫" };

  const llm = expectNode<LLMNode>(workflow, "llm1", "llm");
  llm.label = "LLM";
  llm.description = "使用配置好的模型生成回复。";
  llm.config.messages = [
    { role: "system", content: "你是一个聊天机器人。" },
    { role: "user", content: "讲一个关于 {{start1.topic}} 的笑话。" },
  ];
}

function applyEnglishWorkflowCopy(id: WorkflowTemplateId, workflow: WorkflowFile): void {
  if (id === "blank") {
    return;
  }

  if (id === "support-rag") {
    const start = expectNode<StartNode>(workflow, "start1", "start");
    start.description = "Collect the customer question for this support answer.";
    start.config.fields[0] = {
      ...start.config.fields[0],
      label: "Customer question",
      defaultValue: "I want to request a refund. What is the refund policy?",
    };
    localizeKnowledgeNode(workflow, "Search the Yunduo support knowledge base for relevant customer-support context.");
    const llm = expectNode<LLMNode>(workflow, "llm1", "llm");
    llm.description = "Answer the customer question using retrieved context.";
    llm.config.messages = [
      {
        role: "system",
        content:
          "You are Yunduo's support assistant. Answer only from the provided knowledge-base context. If the context does not contain the answer, say you cannot confirm and suggest contacting human support. Keep the reply concise, accurate, and polite.",
      },
      {
        role: "user",
        content:
          "Knowledge-base context:\n{{knowledge1.context}}\n\nCustomer question: {{start1.customerQuestion}}\n\nAnswer the question in English using only the context above.",
      },
    ];
    return;
  }

  if (id === "support-hitl") {
    const start = expectNode<StartNode>(workflow, "start1", "start");
    start.description = "Collect the customer question.";
    start.config.fields[0] = {
      ...start.config.fields[0],
      label: "Customer question",
      defaultValue: "I want to request a refund. What is the refund policy?",
    };
    localizeKnowledgeNode(workflow, "Search the Yunduo support knowledge base for relevant context.");
    const llm = expectNode<LLMNode>(workflow, "llm1", "llm");
    llm.description = "Draft a reply using retrieved context with conversation memory enabled.";
    llm.config.messages = [
      {
        role: "system",
        content:
          "You are Yunduo's support assistant. Answer only from the provided knowledge-base context. If the context does not contain the answer, say you cannot confirm. Keep the reply concise, accurate, and polite.",
      },
      {
        role: "user",
        content:
          "Knowledge-base context:\n{{knowledge1.context}}\n\nCustomer question: {{start1.customerQuestion}}\n\nDraft an English reply using the context above.",
      },
    ];
    const ifElse = expectNode<IfElseNode>(workflow, "ifElse1", "ifElse");
    ifElse.label = "Needs human review?";
    ifElse.description = "Route refund or complaint questions to human review; auto-reply to the rest.";
    ifElse.config.cases[0] = {
      ...ifElse.config.cases[0],
      conditions: [
        { variable: "{{start1.customerQuestion}}", operator: "contains", value: "refund" },
        { variable: "{{start1.customerQuestion}}", operator: "contains", value: "complaint" },
      ],
    };
    const hitl = expectNode<HumanInputNode>(workflow, "humanInput1", "humanInput");
    hitl.label = "Human review";
    hitl.description = "A reviewer can approve, reject, or rewrite the drafted reply.";
    hitl.config.prompt = "Review this drafted reply (customer question: {{start1.customerQuestion}}):\n\n{{llm1.text}}";
    hitl.config.actions = [
      { id: "approve", label: "Approve", value: "approved" },
      { id: "reject", label: "Reject", value: "rejected" },
    ];
    hitl.config.inputLabel = "Edited reply";
    setNodeCopy(workflow, "endReview", "Human confirmed");
    setNodeCopy(workflow, "endAuto", "Auto-reply sent");
    return;
  }

  if (id === "agent-tools-demo") {
    const start = expectNode<StartNode>(workflow, "start1", "start");
    start.description = "Collect the request for the Agent.";
    start.config.fields[0] = {
      ...start.config.fields[0],
      label: "Request",
      defaultValue: "Get the current time, then call the MCP demo tool to explain how Yunduo connects external tools.",
    };
    const agent = expectNode<AgentNode>(workflow, "agent1", "agent");
    agent.description = "Choose Current Time and Built-in MCP tools, then combine the results into an answer.";
    agent.config.instruction =
      "You are a tool-routing demo Agent for Yunduo workflows. Decide whether tools are needed for the user's request. Use Current Time when time is needed, and use the Built-in MCP tool when explaining MCP capabilities. Keep the answer concise and list the tools you used.";
    setNodeCopy(workflow, "end1", "Done", "Output the Agent's final answer.");
    return;
  }

  const start = expectNode<StartNode>(workflow, "start1", "start");
  start.description = "Collect the customer question.";
  start.config.fields[0] = {
    ...start.config.fields[0],
    label: "Customer question",
    defaultValue: "I want to request a refund. If I submit it today, how long will it take?",
  };
  localizeKnowledgeNode(workflow, "Search the Yunduo support knowledge base for relevant context.");
  const agent = expectNode<AgentNode>(workflow, "agent1", "agent");
  agent.label = "Support Agent";
  agent.description = "Use knowledge-base context and call tools for time or MCP demo details when useful.";
  agent.config.instruction =
    "You are Yunduo's support Agent. First answer from the knowledge-base context. Use Current Time when current time or timezone helps. Use the Built-in MCP tool when explaining external-tool capabilities. Do not invent information missing from the context; suggest contacting human support when you cannot confirm.";
  agent.config.query =
    "Knowledge-base context:\n{{knowledge1.context}}\n\nCustomer question: {{start1.customerQuestion}}\n\nGive a concise, accurate, polite English reply.";
  setNodeCopy(workflow, "end1", "Support reply", "Output the Support Agent's final reply.");
}

function localizeKnowledgeNode(workflow: WorkflowFile, description: string): void {
  const knowledge = expectNode<KnowledgeNode>(workflow, "knowledge1", "knowledge");
  knowledge.description = description;
}

function setNodeCopy(workflow: WorkflowFile, id: string, label: string, description?: string): void {
  const node = workflow.graph.nodes.find((item) => item.id === id);
  if (!node) {
    return;
  }
  node.label = label;
  if (description !== undefined) {
    node.description = description;
  }
}

function expectNode<Node extends WorkflowNode>(workflow: WorkflowFile, id: string, type: Node["type"]): Node {
  const node = workflow.graph.nodes.find((item) => item.id === id);
  if (!node || node.type !== type) {
    throw new Error(`Template node ${id} (${type}) is missing.`);
  }
  return node as Node;
}
