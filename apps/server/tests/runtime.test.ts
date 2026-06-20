import { MemorySaver } from "@langchain/langgraph";
import {
  createDefaultWorkflow,
  createKnowledgeDemoWorkflow,
  createNode,
  type KnowledgeNode,
  type WorkflowFile,
} from "@ai-agent-workflow/workflow-domain";
import { describe, expect, it } from "vitest";
import { chunkKnowledgeText } from "../src/knowledge/chunking";
import { createDeterministicEmbeddingAdapter, type EmbeddingAdapter } from "../src/knowledge/embeddings";
import { createInMemoryKnowledgeRepository, type KnowledgeRepository } from "../src/knowledge/repository";
import { executeWorkflowRuntime, type RuntimeStreamEvent } from "../src/runtime";
import { humanizeModelError } from "../src/runtime/models";

function createModelFetch(text = "Runtime stream output.") {
  return async () =>
    new Response(
      JSON.stringify({
        model: "qwen3.5:0.8b",
        created_at: "2026-06-01T00:00:00.000Z",
        message: { role: "assistant", content: text },
        done: true,
        prompt_eval_count: 5,
        eval_count: 6,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
}

function knowledgeWorkflow(knowledgeBaseIds: string[], overrides: Partial<KnowledgeNode["config"]> = {}): WorkflowFile {
  const workflow = createDefaultWorkflow();
  const knowledge = createNode("knowledge", { x: 360, y: 120 }, workflow.graph.nodes);
  if (knowledge.type !== "knowledge") {
    throw new Error("Expected knowledge node.");
  }
  knowledge.id = "knowledge1";
  knowledge.config = {
    ...knowledge.config,
    knowledgeBaseIds,
    queryTemplate: "{{start1.topic}}",
    retrieval: { mode: "semantic", topK: 2 },
    ...overrides,
  };
  return {
    ...workflow,
    graph: {
      nodes: [workflow.graph.nodes[0], knowledge],
      edges: [{ id: "edge-start-knowledge", source: "start1", target: "knowledge1" }],
    },
  };
}

/** Drives every queued document through chunk → embed → ready, like the runner. */
async function indexQueuedDocuments(repository: KnowledgeRepository, embeddings: EmbeddingAdapter): Promise<void> {
  for (;;) {
    const claimed = await repository.claimNextIndexingDocument(new Date(0));
    if (!claimed) {
      return;
    }
    const chunks = chunkKnowledgeText(claimed.rawText, { title: claimed.title, ...claimed.settings.chunking });
    const vectors = await embeddings.embedTexts(chunks.map((chunk) => chunk.content));
    await repository.replaceDocumentChunks(
      claimed,
      chunks.map((chunk, index) => ({ ...chunk, embedding: vectors[index] })),
    );
    await repository.markDocumentStatus(claimed.id, "ready");
  }
}

async function readyKnowledgeBase(
  userId: string,
  documents: Array<{ title: string; content: string }>,
): Promise<{ repository: KnowledgeRepository; embeddings: EmbeddingAdapter; knowledgeBaseId: string }> {
  const repository = createInMemoryKnowledgeRepository();
  const embeddings = createDeterministicEmbeddingAdapter();
  const knowledgeBase = await repository.create(userId, { name: "中文客服知识库" });
  for (const document of documents) {
    await repository.createTextDocument(userId, knowledgeBase.id, {
      title: document.title,
      content: document.content,
      mimeType: "text/plain",
    });
  }
  await indexQueuedDocuments(repository, embeddings);
  return { repository, embeddings, knowledgeBaseId: knowledgeBase.id };
}

/**
 * A fetch double that records request bodies and answers DeepSeek/OpenAI
 * (`/chat/completions`) and Ollama (`/api/chat`) calls so a Knowledge → LLM
 * chain can be exercised without a real provider. Returned `requests` lets a
 * test assert the resolved prompt the model received.
 */
function createCapturingModelFetch(text = "Mock grounded answer.") {
  const requests: Array<Record<string, unknown>> = [];
  const fetchImpl = (async (url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const requestUrl = String(url);
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    requests.push(body);

    if (requestUrl.includes("/api/chat")) {
      return new Response(
        JSON.stringify({
          model: "qwen3.5:0.8b",
          created_at: "2026-06-01T00:00:00.000Z",
          message: { role: "assistant", content: text },
          done: true,
          prompt_eval_count: 8,
          eval_count: 9,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    if (body.stream) {
      const chunks = [
        { choices: [{ delta: { role: "assistant" } }] },
        { choices: [{ delta: { content: text } }] },
        { choices: [{ delta: {}, finish_reason: "stop" }], usage: { total_tokens: 17 } },
      ];
      return new Response(`${chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("")}data: [DONE]\n\n`, {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    }

    return new Response(JSON.stringify({ choices: [{ message: { content: text } }], usage: { total_tokens: 17 } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;

  return { fetch: fetchImpl, requests };
}

/** Start → Knowledge → LLM workflow whose LLM prompt consumes `{{knowledge1.context}}`. */
function knowledgeToLlmWorkflow(knowledgeBaseIds: string[]): WorkflowFile {
  const workflow = createDefaultWorkflow();
  const start = workflow.graph.nodes.find((node) => node.type === "start");
  const llm = workflow.graph.nodes.find((node) => node.type === "llm");
  const knowledge = createNode("knowledge", { x: 360, y: 120 }, workflow.graph.nodes);
  if (!start || knowledge.type !== "knowledge" || llm?.type !== "llm") {
    throw new Error("Expected start, knowledge, and llm nodes.");
  }
  knowledge.id = "knowledge1";
  knowledge.config = {
    ...knowledge.config,
    knowledgeBaseIds,
    queryTemplate: "{{start1.topic}}",
    retrieval: { mode: "semantic", topK: 2 },
  };
  llm.config = {
    ...llm.config,
    messages: [{ role: "user", content: "资料：{{knowledge1.context}}\n问题：{{start1.topic}}" }],
  };
  return {
    ...workflow,
    graph: {
      nodes: [start, knowledge, llm],
      edges: [
        { id: "edge-start-knowledge", source: "start1", target: "knowledge1" },
        { id: "edge-knowledge-llm", source: "knowledge1", target: "llm1" },
      ],
    },
  };
}

describe("workflow runtime executor", () => {
  it("executes through LangGraph stream callbacks and persists checkpoints", async () => {
    const checkpointer = new MemorySaver();
    const streamEvents: RuntimeStreamEvent[] = [];

    const execution = await executeWorkflowRuntime(createDefaultWorkflow(), { topic: "streaming" }, {
      checkpointer,
      fetch: createModelFetch(),
      onStreamEvent: (event) => {
        streamEvents.push(event);
      },
      threadId: "runtime-stream-test",
    });

    expect(execution.ok).toBe(true);
    expect(execution.streamEvents).toEqual(streamEvents);
    expect(streamEvents.some((event) => event.type === "node.started" && event.nodeId === "start1")).toBe(true);
    expect(streamEvents.some((event) => event.type === "node.completed" && event.nodeId === "llm1")).toBe(true);
    if (execution.ok) {
      expect(execution.state.llm1).toMatchObject({ text: "Runtime stream output." });
    }

    const checkpoint = await checkpointer.getTuple({ configurable: { thread_id: "runtime-stream-test" } });
    expect(checkpoint?.checkpoint.channel_values.values).toMatchObject({
      start1: { topic: "streaming" },
      llm1: { text: "Runtime stream output." },
    });
  });

  it("reports consumed tokens and succeeds within the credit budget", async () => {
    const execution = await executeWorkflowRuntime(createDefaultWorkflow(), { topic: "budget" }, {
      checkpointer: new MemorySaver(),
      fetch: createModelFetch(),
      // The mock reports 5 input + 6 output = 11 tokens; budget comfortably above.
      creditBudget: 1000,
    });

    expect(execution.ok).toBe(true);
    expect(execution.consumedTokens).toBe(11);
  });

  it("stops the run and reports credits_exhausted once the budget is spent", async () => {
    const streamEvents: RuntimeStreamEvent[] = [];
    const execution = await executeWorkflowRuntime(createDefaultWorkflow(), { topic: "over" }, {
      checkpointer: new MemorySaver(),
      fetch: createModelFetch(),
      // 11 tokens consumed exceeds this budget, so the run must fail.
      creditBudget: 5,
      onStreamEvent: (event) => {
        streamEvents.push(event);
      },
    });

    expect(execution.ok).toBe(false);
    if (!execution.ok) {
      expect(execution.error.code).toBe("credits_exhausted");
    }
    expect(execution.consumedTokens).toBeGreaterThanOrEqual(5);
    expect(streamEvents.some((event) => event.type === "node.failed")).toBe(true);
  });

  it("streams node.failed for the running node when the model call throws", async () => {
    const streamEvents: RuntimeStreamEvent[] = [];

    const execution = await executeWorkflowRuntime(createDefaultWorkflow(), { topic: "boom" }, {
      checkpointer: new MemorySaver(),
      // Simulate the "fetch failed" network error the LLM node hit in production.
      fetch: async () => {
        throw new Error("fetch failed");
      },
      onStreamEvent: (event) => {
        streamEvents.push(event);
      },
      threadId: "runtime-failure-test",
    });

    expect(execution.ok).toBe(false);
    // The failing node must emit node.failed so the client can render it instead
    // of leaving the node stuck "running".
    const failed = streamEvents.find((event) => event.type === "node.failed" && event.nodeId === "llm1");
    expect(failed).toBeDefined();
    // …and it must carry a real message (not a generic placeholder) so the UI
    // can show why it failed.
    expect(failed?.message).toContain("fetch failed");
  });

  it("fails before provider calls when a paid provider has no resolved API key", async () => {
    const workflow = createDefaultWorkflow();
    workflow.settings.modelProvider = {
      provider: "deepseek",
      baseURL: "https://api.deepseek.com",
      model: "deepseek-chat",
    };

    let called = false;
    const execution = await executeWorkflowRuntime(workflow, { topic: "missing key" }, {
      checkpointer: new MemorySaver(),
      fetch: async () => {
        called = true;
        return new Response("{}", { status: 200 });
      },
    });

    expect(execution.ok).toBe(false);
    if (!execution.ok) {
      expect(execution.error.message).toContain("API key is not configured for provider deepseek.");
    }
    expect(called).toBe(false);
  });

  it("retrieves ready knowledge chunks and stores structured output", async () => {
    const { repository, embeddings, knowledgeBaseId } = await readyKnowledgeBase("user-1", [
      { title: "退款说明", content: "云舵支持 7 天内自助退款。企业客户可以联系人工客服处理发票和退款。" },
      { title: "登录问题", content: "如果无法登录，请先重置密码，再检查团队管理员是否停用了账号。" },
    ]);

    const execution = await executeWorkflowRuntime(knowledgeWorkflow([knowledgeBaseId]), { topic: "怎么退款" }, {
      checkpointer: new MemorySaver(),
      embeddings,
      knowledge: repository,
      userId: "user-1",
    });

    expect(execution.ok).toBe(true);
    if (execution.ok) {
      expect(execution.state.knowledge1).toMatchObject({
        query: "怎么退款",
        result: expect.any(Array),
      });
      expect(String(execution.state.knowledge1.context)).toContain("资料 1");
      expect(execution.nodeResults.find((result) => result.nodeId === "knowledge1")?.data?.result).toHaveLength(2);
    }
  });

  it("fails knowledge retrieval when query variables are missing", async () => {
    const { repository, embeddings, knowledgeBaseId } = await readyKnowledgeBase("user-1", [
      { title: "退款说明", content: "退款需要在账单页面提交。" },
    ]);

    const execution = await executeWorkflowRuntime(
      knowledgeWorkflow([knowledgeBaseId], { queryTemplate: "{{start1.missing}}" }),
      { topic: "退款" },
      { checkpointer: new MemorySaver(), embeddings, knowledge: repository, userId: "user-1" },
    );

    expect(execution.ok).toBe(false);
    if (!execution.ok) {
      expect(execution.error.message).toContain("Missing prompt variable values");
    }
  });

  it("fails knowledge retrieval for unreadable private knowledge bases", async () => {
    const { repository, embeddings, knowledgeBaseId } = await readyKnowledgeBase("owner", [
      { title: "私有内容", content: "只有 owner 可以读取。" },
    ]);

    const execution = await executeWorkflowRuntime(knowledgeWorkflow([knowledgeBaseId]), { topic: "私有内容" }, {
      checkpointer: new MemorySaver(),
      embeddings,
      knowledge: repository,
      userId: "other-user",
    });

    expect(execution.ok).toBe(false);
    if (!execution.ok) {
      expect(execution.error.message).toContain("not found or is not readable");
    }
  });

  it("fails knowledge retrieval when selected content is not indexed yet", async () => {
    const repository = createInMemoryKnowledgeRepository();
    const embeddings = createDeterministicEmbeddingAdapter();
    const knowledgeBase = await repository.create("user-1", { name: "待索引知识库" });
    await repository.createTextDocument("user-1", knowledgeBase.id, {
      title: "排队文档",
      content: "这份文档还没有完成 embedding。",
    });

    const execution = await executeWorkflowRuntime(knowledgeWorkflow([knowledgeBase.id]), { topic: "embedding" }, {
      checkpointer: new MemorySaver(),
      embeddings,
      knowledge: repository,
      userId: "user-1",
    });

    expect(execution.ok).toBe(false);
    if (!execution.ok) {
      expect(execution.error.message).toContain("no ready indexed content");
    }
  });

  it("runs the anonymous customer-support demo against the seeded example KB", async () => {
    const repository = createInMemoryKnowledgeRepository();
    const embeddings = createDeterministicEmbeddingAdapter();
    await repository.ensureExampleKnowledgeBase();
    await indexQueuedDocuments(repository, embeddings);

    const workflow = createKnowledgeDemoWorkflow();
    workflow.settings.modelProviderKeys = { deepseek: "test-deepseek-key" };

    const { fetch: modelFetch, requests } = createCapturingModelFetch("您可以在购买后 7 天内申请退款。");
    const execution = await executeWorkflowRuntime(
      workflow,
      { customerQuestion: "我要退款，请问退款政策是什么？" },
      { checkpointer: new MemorySaver(), embeddings, knowledge: repository, userId: null, fetch: modelFetch },
    );

    expect(execution.ok).toBe(true);
    if (execution.ok) {
      expect(execution.nodeResults.map((result) => result.nodeId)).toEqual(["start1", "knowledge1", "llm1"]);
      expect(execution.state.knowledge1.query).toBe("我要退款，请问退款政策是什么？");
      expect((execution.state.knowledge1.result as unknown[]).length).toBeGreaterThan(0);
      expect(String(execution.state.knowledge1.context)).toContain("资料 1");
      expect(execution.state.llm1).toMatchObject({ text: "您可以在购买后 7 天内申请退款。" });
    }
    // Anonymous reads resolve the example KB, and the retrieved context reaches the LLM prompt.
    expect(JSON.stringify(requests.at(-1))).toContain("资料 1");
  });

  it("indexes a user KB and feeds retrieved context to a downstream LLM node", async () => {
    const { repository, embeddings, knowledgeBaseId } = await readyKnowledgeBase("user-1", [
      { title: "退款说明", content: "云舵支持购买后 7 天内自助退款，企业客户可联系人工客服处理发票与退款。" },
    ]);

    const { fetch: modelFetch, requests } = createCapturingModelFetch("您可以在 7 天内自助申请退款。");
    const execution = await executeWorkflowRuntime(
      knowledgeToLlmWorkflow([knowledgeBaseId]),
      { topic: "怎么退款" },
      { checkpointer: new MemorySaver(), embeddings, knowledge: repository, userId: "user-1", fetch: modelFetch },
    );

    expect(execution.ok).toBe(true);
    if (execution.ok) {
      expect(execution.nodeResults.map((result) => result.nodeId)).toEqual(["start1", "knowledge1", "llm1"]);
      expect(execution.state.llm1).toMatchObject({ text: "您可以在 7 天内自助申请退款。" });
    }
    // The LLM node consumed the {{knowledge1.context}} produced upstream.
    expect(JSON.stringify(requests.at(-1))).toContain("资料 1");
  });

  it("applies knowledge retrieval topK and scoreThreshold", async () => {
    const { repository, embeddings, knowledgeBaseId } = await readyKnowledgeBase("user-1", [
      { title: "退款说明", content: "退款 退款 退款 账单 发票 客服。" },
      { title: "密码说明", content: "密码 登录 登录 账号 重置。" },
      { title: "权限说明", content: "成员 权限 团队 管理员。" },
    ]);

    const execution = await executeWorkflowRuntime(
      knowledgeWorkflow([knowledgeBaseId], { retrieval: { mode: "semantic", topK: 1, scoreThreshold: 0 } }),
      { topic: "退款" },
      { checkpointer: new MemorySaver(), embeddings, knowledge: repository, userId: "user-1" },
    );

    expect(execution.ok).toBe(true);
    if (execution.ok) {
      expect((execution.state.knowledge1.result as unknown[]).length).toBe(1);
      expect((execution.state.knowledge1.result as Array<{ metadata: { score: number } }>)[0].metadata.score).toBeGreaterThanOrEqual(0);
    }
  });
});

/** Start → If/Else → (case-1 → matched1) / (else → fallback1). */
function ifElseWorkflow(): WorkflowFile {
  const workflow = createDefaultWorkflow();
  const start = workflow.graph.nodes.find((node) => node.type === "start");
  if (!start) {
    throw new Error("Expected start node.");
  }
  const ifElse = createNode("ifElse", { x: 300, y: 120 }, workflow.graph.nodes);
  if (ifElse.type !== "ifElse") {
    throw new Error("Expected If/Else node.");
  }
  ifElse.id = "ifElse1";
  ifElse.config = {
    cases: [
      { id: "case-1", combinator: "and", conditions: [{ variable: "{{start1.topic}}", operator: "contains", value: "refund" }] },
    ],
  };
  const matched = createNode("template", { x: 560, y: 60 }, workflow.graph.nodes);
  matched.id = "matched1";
  const fallback = createNode("template", { x: 560, y: 200 }, workflow.graph.nodes);
  fallback.id = "fallback1";

  return {
    ...workflow,
    graph: {
      nodes: [start, ifElse, matched, fallback],
      edges: [
        { id: "edge-start-ifelse", source: "start1", target: "ifElse1" },
        { id: "edge-ifelse-matched", source: "ifElse1", target: "matched1", sourceHandle: "case-1" },
        { id: "edge-ifelse-else", source: "ifElse1", target: "fallback1", sourceHandle: "else" },
      ],
    },
  };
}

describe("If/Else routing", () => {
  it("routes down the matching case and skips the other branch", async () => {
    const execution = await executeWorkflowRuntime(ifElseWorkflow(), { topic: "please refund my order" }, {
      fetch: createModelFetch(),
    });

    expect(execution.ok).toBe(true);
    const ranNodeIds = new Set(execution.nodeResults.map((result) => result.nodeId));
    expect(ranNodeIds.has("matched1")).toBe(true);
    expect(ranNodeIds.has("fallback1")).toBe(false);
    expect(execution.nodeResults.find((result) => result.nodeId === "ifElse1")?.data?.matched).toBe("case-1");
  });

  it("routes to the else branch when no case matches", async () => {
    const execution = await executeWorkflowRuntime(ifElseWorkflow(), { topic: "just saying hello" }, {
      fetch: createModelFetch(),
    });

    expect(execution.ok).toBe(true);
    const ranNodeIds = new Set(execution.nodeResults.map((result) => result.nodeId));
    expect(ranNodeIds.has("fallback1")).toBe(true);
    expect(ranNodeIds.has("matched1")).toBe(false);
    expect(execution.nodeResults.find((result) => result.nodeId === "ifElse1")?.data?.matched).toBe("else");
  });
});

/** Start → Human Input → done. */
function humanInputWorkflow(): WorkflowFile {
  const workflow = createDefaultWorkflow();
  const start = workflow.graph.nodes.find((node) => node.type === "start");
  if (!start) {
    throw new Error("Expected start node.");
  }
  const hitl = createNode("humanInput", { x: 300, y: 120 }, workflow.graph.nodes);
  if (hitl.type !== "humanInput") {
    throw new Error("Expected Human Input node.");
  }
  hitl.id = "humanInput1";
  hitl.config = {
    prompt: "approve refund?",
    actions: [
      { id: "approve", label: "Approve", value: "yes" },
      { id: "reject", label: "Reject", value: "no" },
    ],
    allowTextInput: true,
  };
  const done = createNode("template", { x: 560, y: 120 }, workflow.graph.nodes);
  done.id = "done1";

  return {
    ...workflow,
    graph: {
      nodes: [start, hitl, done],
      edges: [
        { id: "edge-start-hitl", source: "start1", target: "humanInput1" },
        { id: "edge-hitl-done", source: "humanInput1", target: "done1" },
      ],
    },
  };
}

describe("Human Input (HITL) pause and resume", () => {
  it("pauses on interrupt then resumes with the reviewer's answer", async () => {
    const checkpointer = new MemorySaver();
    const workflow = humanInputWorkflow();

    const first = await executeWorkflowRuntime(workflow, { topic: "refund" }, {
      checkpointer,
      threadId: "thread-hitl",
      fetch: createModelFetch(),
    });

    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    expect(first.status).toBe("waiting_human");
    expect(first.interrupt?.nodeId).toBe("humanInput1");
    expect((first.interrupt?.value as { prompt?: string }).prompt).toBe("approve refund?");
    expect(first.nodeResults.some((result) => result.nodeId === "done1")).toBe(false);

    const second = await executeWorkflowRuntime(workflow, { topic: "refund" }, {
      checkpointer,
      threadId: "thread-hitl",
      fetch: createModelFetch(),
      resume: { value: { action_id: "approve", action_value: "yes" } },
    });

    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }
    expect(second.status).toBe("completed");
    expect(second.state.humanInput1).toEqual({ action_id: "approve", action_value: "yes" });
    expect(second.nodeResults.some((result) => result.nodeId === "done1")).toBe(true);
  });

  it("carries free-text submissions through as the __input__ action", async () => {
    const checkpointer = new MemorySaver();
    const workflow = humanInputWorkflow();

    await executeWorkflowRuntime(workflow, { topic: "refund" }, {
      checkpointer,
      threadId: "thread-hitl-text",
      fetch: createModelFetch(),
    });
    const resumed = await executeWorkflowRuntime(workflow, { topic: "refund" }, {
      checkpointer,
      threadId: "thread-hitl-text",
      fetch: createModelFetch(),
      resume: { value: { action_id: "__input__", action_value: "请帮我转人工" } },
    });

    expect(resumed.ok).toBe(true);
    if (!resumed.ok) {
      return;
    }
    expect(resumed.state.humanInput1).toEqual({ action_id: "__input__", action_value: "请帮我转人工" });
  });
});

/** Start → Email tool. */
function emailWorkflow(send: boolean): WorkflowFile {
  const workflow = createDefaultWorkflow();
  const start = workflow.graph.nodes.find((node) => node.type === "start");
  if (!start) {
    throw new Error("Expected start node.");
  }
  const tool = createNode("tool", { x: 300, y: 120 }, workflow.graph.nodes);
  if (tool.type !== "tool") {
    throw new Error("Expected tool node.");
  }
  tool.id = "email1";
  tool.config = {
    provider: "builtin",
    providerId: "builtin",
    toolName: "emailSend",
    params: {
      to: "user@example.com",
      subject: "Re: {{start1.topic}}",
      body: "Hi about {{start1.topic}}",
      send,
    },
  };
  return {
    ...workflow,
    graph: {
      nodes: [start, tool],
      edges: [{ id: "edge-start-email", source: "start1", target: "email1" }],
    },
  };
}

/** Start → Current Time tool with the given bound config. */
function currentTimeWorkflow(config: { toolName: string; params: Record<string, unknown> }): WorkflowFile {
  const workflow = createDefaultWorkflow();
  const start = workflow.graph.nodes.find((node) => node.type === "start");
  if (!start) {
    throw new Error("Expected start node.");
  }
  const tool = createNode("tool", { x: 300, y: 120 }, workflow.graph.nodes);
  if (tool.type !== "tool") {
    throw new Error("Expected tool node.");
  }
  tool.id = "time1";
  tool.config = { provider: "builtin", providerId: "builtin", ...config } as typeof tool.config;
  return {
    ...workflow,
    graph: {
      nodes: [start, tool],
      edges: [{ id: "edge-start-time", source: "start1", target: "time1" }],
    },
  };
}

/** Start → LLM(memory) whose human prompt is exactly the topic. */
function memoryWorkflow(): WorkflowFile {
  const workflow = createDefaultWorkflow();
  const start = workflow.graph.nodes.find((node) => node.type === "start");
  const llm = workflow.graph.nodes.find((node) => node.type === "llm");
  if (!start || llm?.type !== "llm") {
    throw new Error("Expected start and llm nodes.");
  }
  llm.config = {
    ...llm.config,
    messages: [
      { role: "system", content: "sys" },
      { role: "user", content: "{{start1.topic}}" },
    ],
    memory: true,
  };
  return {
    ...workflow,
    graph: { nodes: [start, llm], edges: [{ id: "edge-start-llm", source: "start1", target: "llm1" }] },
  };
}

/** Chat-mode Start → LLM(memory) whose human prompt is the live chat query. */
function chatMemoryWorkflow(): WorkflowFile {
  const workflow = memoryWorkflow();
  const llm = workflow.graph.nodes.find((node) => node.type === "llm");
  if (llm?.type !== "llm") {
    throw new Error("Expected llm node.");
  }
  llm.config = {
    ...llm.config,
    messages: [
      { role: "system", content: "sys" },
      { role: "user", content: "{{userInput.query}}" },
    ],
  };
  return {
    ...workflow,
    metadata: { ...workflow.metadata, mode: "chat" },
    settings: { ...workflow.settings, modelProviderKeys: { deepseek: "test-deepseek-key" } },
  };
}

describe("conversation memory", () => {
  it("carries prior turns into later runs that share a thread", async () => {
    const checkpointer = new MemorySaver();
    const { fetch, requests } = createCapturingModelFetch("好的");
    const workflow = memoryWorkflow();

    await executeWorkflowRuntime(workflow, { topic: "我叫小明" }, { checkpointer, threadId: "conv-A", fetch });
    const second = await executeWorkflowRuntime(workflow, { topic: "我叫什么" }, { checkpointer, threadId: "conv-A", fetch });

    expect(second.ok).toBe(true);
    const lastBody = requests.at(-1) as { messages: Array<{ role: string; content: string }> };
    const contents = lastBody.messages.map((message) => message.content);
    // The second turn sees turn 1 (user + assistant) before the current question.
    expect(contents).toContain("我叫小明");
    expect(contents).toContain("好的");
    expect(contents).toContain("我叫什么");
  });

  it("keeps separate threads isolated", async () => {
    const checkpointer = new MemorySaver();
    const { fetch, requests } = createCapturingModelFetch("ok");
    const workflow = memoryWorkflow();

    await executeWorkflowRuntime(workflow, { topic: "thread-one-secret" }, { checkpointer, threadId: "conv-1", fetch });
    await executeWorkflowRuntime(workflow, { topic: "thread-two-question" }, { checkpointer, threadId: "conv-2", fetch });

    const lastContents = (requests.at(-1) as { messages: Array<{ content: string }> }).messages.map((m) => m.content);
    expect(lastContents).not.toContain("thread-one-secret");
  });

  it("remembers a failed chat turn's user message so the next turn can continue", async () => {
    const checkpointer = new MemorySaver();
    const workflow = chatMemoryWorkflow();

    // Turn 1 fails at the model call (network error) before the LLM node commits its
    // [user, assistant] memory pair. Turn 2 must still see turn 1's question.
    const { fetch: okFetch, requests } = createCapturingModelFetch("好的");
    let firstCall = true;
    const fetch = (async (url: Parameters<typeof okFetch>[0], init?: Parameters<typeof okFetch>[1]) => {
      if (firstCall) {
        firstCall = false;
        throw new Error("fetch failed");
      }
      return okFetch(url, init);
    }) as unknown as typeof okFetch;

    const first = await executeWorkflowRuntime(
      workflow,
      {},
      { checkpointer, threadId: "conv-fail", query: "你那里的时区时间是多少？", fetch },
    );
    expect(first.ok).toBe(false);

    const second = await executeWorkflowRuntime(
      workflow,
      {},
      { checkpointer, threadId: "conv-fail", query: "继续", fetch },
    );
    expect(second.ok).toBe(true);

    const lastContents = (requests.at(-1) as { messages: Array<{ content: string }> }).messages.map((m) => m.content);
    expect(lastContents).toContain("你那里的时区时间是多少？");
    expect(lastContents).toContain("继续");
  });
});

describe("Email tool", () => {
  it("composes the email in dry-run without sending", async () => {
    const sent: unknown[] = [];
    const execution = await executeWorkflowRuntime(emailWorkflow(false), { topic: "refund" }, {
      emailSender: async (email) => {
        sent.push(email);
        return {};
      },
    });

    expect(execution.ok).toBe(true);
    if (!execution.ok) {
      return;
    }
    expect(sent).toHaveLength(0);
    const email = execution.state.email1.data as { to: string; subject: string; sent: boolean; dryRun: boolean };
    expect(email).toMatchObject({ to: "user@example.com", subject: "Re: refund", sent: false, dryRun: true });
  });

  it("sends the email through the configured sender when send is enabled", async () => {
    const sent: Array<{ subject: string }> = [];
    const execution = await executeWorkflowRuntime(emailWorkflow(true), { topic: "refund" }, {
      emailSender: async (email) => {
        sent.push(email);
        return { id: "email_123" };
      },
    });

    expect(execution.ok).toBe(true);
    if (!execution.ok) {
      return;
    }
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toBe("Re: refund");
    const email = execution.state.email1.data as { sent: boolean; id?: string };
    expect(email).toMatchObject({ sent: true, id: "email_123" });
  });

  it("fails real send when no email sender is configured", async () => {
    const execution = await executeWorkflowRuntime(emailWorkflow(true), { topic: "x" }, {});
    expect(execution.ok).toBe(false);
  });
});

describe("Current Time tool", () => {
  it("formats the current time in the configured timezone", async () => {
    const execution = await executeWorkflowRuntime(
      currentTimeWorkflow({ toolName: "currentTime", params: { timezone: "Asia/Shanghai" } }),
      { topic: "x" },
      {},
    );

    expect(execution.ok).toBe(true);
    if (!execution.ok) {
      return;
    }
    const data = execution.state.time1.data as { timezone: string; iso: string; formatted: string };
    expect(data.timezone).toBe("Asia/Shanghai");
    expect(typeof data.formatted).toBe("string");
    expect(data.formatted.length).toBeGreaterThan(0);
  });

  it("fails on an invalid timezone", async () => {
    const execution = await executeWorkflowRuntime(
      currentTimeWorkflow({ toolName: "currentTime", params: { timezone: "Not/AZone" } }),
      { topic: "x" },
      {},
    );
    expect(execution.ok).toBe(false);
  });

  it("fails when bound to an unknown tool", async () => {
    const execution = await executeWorkflowRuntime(
      currentTimeWorkflow({ toolName: "doesNotExist", params: {} }),
      { topic: "x" },
      {},
    );
    expect(execution.ok).toBe(false);
  });
});

describe("humanizeModelError", () => {
  it("extracts the provider error message and status from a LangChain body", () => {
    const raw =
      '404 {"type":"error","error":{"type":"not_found_error","message":"Not found"},"request_id":"req_1"}\n\nTroubleshooting URL: https://docs.langchain.com/errors/MODEL_NOT_FOUND/\n';
    expect(humanizeModelError(raw)).toBe("404: Not found");
  });

  it("falls back to cleaned text when there is no provider JSON", () => {
    expect(humanizeModelError("fetch failed\n\nTroubleshooting URL: https://x")).toBe("fetch failed");
  });
});
