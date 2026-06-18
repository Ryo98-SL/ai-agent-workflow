import type {
  CreateCustomModelRequest,
  CreateFileKnowledgeDocumentRequest,
  CreateKnowledgeBaseRequest,
  CreateMcpServerRequest,
  CreateTextKnowledgeDocumentRequest,
  CreateRunRequest,
  ResumeRunRequest,
  CreditStatusResponse,
  CustomModelDto,
  KnowledgeBaseDto,
  KnowledgeDocumentDto,
  McpServerDto,
  ProviderKeyDto,
  RunEvent,
  RunInterrupt,
  UpdateKnowledgeBaseRequest,
  UpdateMcpServerRequest,
  WorkflowDto,
  WorkflowRun,
  WorkflowSummary,
} from "@ai-agent-workflow/api-contracts";
import type {
  ModelProviderKeys,
  OpenAICompatibleSettings,
  ToolProvider,
  WorkflowFile,
  WorkflowNode,
  WorkflowNodeType,
} from "@ai-agent-workflow/workflow-domain";

/** Identity triple a Tool node binds to when added/rebound via the Tool Browser. */
export type ToolIdentity = { provider: ToolProvider; providerId: string; toolName: string };

type NodeExecutionStateBase = {
  nodeId: string;
  status: "running" | "succeeded" | "failed";
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
};

/** One live tool call in an Agent node's run, built from `agent.tool` SSE events. */
export type AgentToolStep = {
  tool: string;
  status: "running" | "done";
  /** Short text preview of the tool's return (present once the call ends). */
  result?: string;
};

/**
 * Streaming-capable node state — LLM and Agent nodes both stream a final answer
 * (and Agent nodes also accumulate a live tool-call strip via `toolSteps`).
 */
export type StreamingNodeExecutionState = NodeExecutionStateBase & {
  nodeType: "llm" | "agent";
  streamingText: string;
  inputTokens?: number;
  outputTokens?: number;
  output?: string;
  data?: Record<string, unknown>;
  error?: string;
  /** Agent only: ordered live tool-call strip. */
  toolSteps?: AgentToolStep[];
};

/** @deprecated Use {@link StreamingNodeExecutionState} (now covers Agent too). */
export type LlmNodeExecutionState = StreamingNodeExecutionState;

export type GenericNodeExecutionState = NodeExecutionStateBase & {
  nodeType: Exclude<WorkflowNodeType, "llm" | "agent">;
  output?: string;
  data?: Record<string, unknown>;
  error?: string;
};

export type NodeExecutionState = StreamingNodeExecutionState | GenericNodeExecutionState;

export type WorkbenchStatus = "idle" | "loading" | "running" | "waiting" | "success" | "error";

export type DebugState = {
  status: WorkbenchStatus;
  result?: {
    run: WorkflowRun;
    events: RunEvent[];
  };
  error?: string;
  /** Set when `status === "waiting"`: the paused run + its reviewer form. */
  waiting?: {
    runId: string;
    interrupt: RunInterrupt;
  };
};

/**
 * One user→assistant exchange in a Chat Mode conversation. The most recent turn
 * is "live": while it is running/waiting the assistant bubble renders from the
 * active `nodeStates`/`debugState`; on completion the turn captures a snapshot of
 * the run (derived `answer`, node states, and result) so its execution trace stays
 * inspectable after later turns start.
 */
export type ChatTurn = {
  id: string;
  query: string;
  status: WorkbenchStatus;
  /** Derived assistant reply (reached End Answer Template, else last LLM text). */
  answer: string;
  runId?: string;
  error?: string;
  /** Captured at completion so the per-turn trace survives subsequent turns. */
  nodeStates?: Map<string, NodeExecutionState>;
  result?: {
    run: WorkflowRun;
    events: RunEvent[];
  };
};

export type WorkbenchWorkflowApi = {
  listWorkflows: () => Promise<{ workflows: WorkflowSummary[] }>;
  createWorkflow: (request?: { workflow?: WorkflowFile }) => Promise<{ workflow: WorkflowDto }>;
  getWorkflow: (id: string) => Promise<{ workflow: WorkflowDto }>;
  updateWorkflow: (id: string, request: { workflow: WorkflowFile }) => Promise<{ workflow: WorkflowDto }>;
  deleteWorkflow: (id: string) => Promise<void>;
  createRun: (workflowId: string, request?: CreateRunRequest) => Promise<{ run: WorkflowRun }>;
  listWorkflowRuns: (workflowId: string) => Promise<{ runs: WorkflowRun[] }>;
  deleteRun: (runId: string) => Promise<void>;
  resumeRun: (runId: string, request: ResumeRunRequest) => Promise<{ run: WorkflowRun }>;
  getRun: (runId: string) => Promise<{ run: WorkflowRun }>;
  listRunEvents: (runId: string) => Promise<{ events: RunEvent[] }>;
  runStreamUrl: (runId: string) => string;
  listKnowledgeBases: () => Promise<{ knowledgeBases: KnowledgeBaseDto[] }>;
  createKnowledgeBase: (request: CreateKnowledgeBaseRequest) => Promise<{ knowledgeBase: KnowledgeBaseDto }>;
  getKnowledgeBase: (id: string) => Promise<{ knowledgeBase: KnowledgeBaseDto }>;
  updateKnowledgeBase: (
    id: string,
    request: UpdateKnowledgeBaseRequest,
  ) => Promise<{ knowledgeBase: KnowledgeBaseDto }>;
  deleteKnowledgeBase: (id: string) => Promise<void>;
  listKnowledgeBaseDocuments: (knowledgeBaseId: string) => Promise<{ documents: KnowledgeDocumentDto[] }>;
  createTextKnowledgeDocument: (
    knowledgeBaseId: string,
    request: CreateTextKnowledgeDocumentRequest,
  ) => Promise<{ document: KnowledgeDocumentDto }>;
  createFileKnowledgeDocument: (
    knowledgeBaseId: string,
    request: CreateFileKnowledgeDocumentRequest,
  ) => Promise<{ document: KnowledgeDocumentDto }>;
  deleteKnowledgeDocument: (id: string) => Promise<void>;
  reindexKnowledgeDocument: (id: string) => Promise<{ document: KnowledgeDocumentDto }>;
  listMcpServers: () => Promise<{ servers: McpServerDto[] }>;
  createMcpServer: (request: CreateMcpServerRequest) => Promise<{ server: McpServerDto }>;
  updateMcpServer: (id: string, request: UpdateMcpServerRequest) => Promise<{ server: McpServerDto }>;
  refreshMcpServer: (id: string) => Promise<{ server: McpServerDto }>;
  deleteMcpServer: (id: string) => Promise<void>;
  listProviderKeys: () => Promise<{ keys: ProviderKeyDto[] }>;
  createProviderKey: (request: { provider: string; label: string; apiKey: string }) => Promise<{ key: ProviderKeyDto }>;
  deleteProviderKey: (id: string) => Promise<void>;
  listCustomModels: () => Promise<{ models: CustomModelDto[] }>;
  createCustomModel: (request: CreateCustomModelRequest) => Promise<{ model: CustomModelDto }>;
  deleteCustomModel: (id: string) => Promise<void>;
  getCredits: () => Promise<CreditStatusResponse>;
  applyCredits: () => Promise<CreditStatusResponse>;
};

export type AppWorkbenchProps = {
  workflowApi: WorkbenchWorkflowApi;
  showDevModelProviders?: boolean;
  initialWorkflowId?: string;
  onWorkflowIdChange?: (workflowId: string | undefined) => void;
  /** Destination for the workbench header back button. Defaults to the host root. */
  homeHref?: string;
  /**
   * Base URL of the auth/api server, used to construct the Better Auth client.
   * Defaults to VITE_WORKFLOW_API_BASE_URL semantics on the host app side.
   */
  apiBaseUrl?: string;
};

export type WorkflowNodePaletteHandleType = "target" | "source";

/** Card-level actions exposed by the node's three-dot menu. */
export type WorkflowNodeAction = "copy" | "duplicate" | "delete";
export type WorkflowNodeActionHandler = (nodeId: string, action: WorkflowNodeAction) => void;

export type AddNodeOptions = {
  sourceNodeId?: string;
  handleType?: WorkflowNodePaletteHandleType;
  /** Which source handle the connecting edge leaves from (multi-output nodes). */
  sourceHandleId?: string;
  /**
   * Flow-coordinate point the new node should center on. Used by cursor-follow
   * placement from the left palette; ignored when connecting from a source node.
   */
  position?: { x: number; y: number };
  /**
   * Edge Insert: splice the new node onto an existing edge. The original edge is
   * deleted; the node is wired in as `source → N (→ target)`. For multi-output
   * nodes only the input is wired and the target is left dangling. See CONTEXT.md
   * "Edge Insert". Takes precedence over `sourceNodeId`/`position`.
   */
  insertOnEdge?: {
    edgeId: string;
    sourceNodeId: string;
    sourceHandleId?: string;
    targetNodeId: string;
  };
  /**
   * Tool Browser binding: when `type === "tool"`, bind the created node to this
   * tool (config from the descriptor's defaults). Absent → the currentTime default.
   */
  tool?: ToolIdentity;
};

export type WorkflowMutators = {
  updateNode: (nodeId: string, updater: (node: WorkflowNode) => WorkflowNode) => void;
  updateModelSettings: (settings: OpenAICompatibleSettings, providerKeys: ModelProviderKeys) => void;
  addNode: (type: WorkflowNodeType, options?: AddNodeOptions) => void;
};
