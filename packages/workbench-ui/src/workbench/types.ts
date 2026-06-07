import type {
  CreateCustomModelRequest,
  CreateRunRequest,
  CreditStatusResponse,
  CustomModelDto,
  ProviderKeyDto,
  RunEvent,
  WorkflowDto,
  WorkflowRun,
  WorkflowSummary,
} from "@ai-agent-workflow/api-contracts";
import type {
  ModelProviderKeys,
  OpenAICompatibleSettings,
  WorkflowFile,
  WorkflowNode,
  WorkflowNodeType,
} from "@ai-agent-workflow/workflow-domain";

type NodeExecutionStateBase = {
  nodeId: string;
  status: "running" | "succeeded" | "failed";
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
};

export type LlmNodeExecutionState = NodeExecutionStateBase & {
  nodeType: "llm";
  streamingText: string;
  inputTokens?: number;
  outputTokens?: number;
  output?: string;
  data?: Record<string, unknown>;
  error?: string;
};

export type GenericNodeExecutionState = NodeExecutionStateBase & {
  nodeType: Exclude<WorkflowNodeType, "llm">;
  output?: string;
  data?: Record<string, unknown>;
  error?: string;
};

export type NodeExecutionState = LlmNodeExecutionState | GenericNodeExecutionState;

export type WorkbenchStatus = "idle" | "loading" | "running" | "success" | "error";

export type DebugState = {
  status: WorkbenchStatus;
  result?: {
    run: WorkflowRun;
    events: RunEvent[];
  };
  error?: string;
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
  getRun: (runId: string) => Promise<{ run: WorkflowRun }>;
  listRunEvents: (runId: string) => Promise<{ events: RunEvent[] }>;
  runStreamUrl: (runId: string) => string;
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
  /**
   * Base URL of the auth/api server, used to construct the Better Auth client.
   * Defaults to VITE_WORKFLOW_API_BASE_URL semantics on the host app side.
   */
  apiBaseUrl?: string;
};

export type WorkflowNodePaletteHandleType = "target" | "source";

export type AddNodeOptions = {
  sourceNodeId?: string;
  handleType?: WorkflowNodePaletteHandleType;
};

export type WorkflowMutators = {
  updateNode: (nodeId: string, updater: (node: WorkflowNode) => WorkflowNode) => void;
  updateModelSettings: (settings: OpenAICompatibleSettings, providerKeys: ModelProviderKeys) => void;
  addNode: (type: WorkflowNodeType, options?: AddNodeOptions) => void;
};
