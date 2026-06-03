import type { CreateRunRequest, RunEvent, WorkflowDto, WorkflowRun, WorkflowSummary } from "@ai-agent-workflow/api-contracts";
import type {
  ModelProviderKeys,
  OpenAICompatibleSettings,
  WorkflowFile,
  WorkflowNode,
  WorkflowNodeType,
} from "@ai-agent-workflow/workflow-domain";

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
  createRun: (workflowId: string, request?: CreateRunRequest) => Promise<{ run: WorkflowRun }>;
  listRunEvents: (runId: string) => Promise<{ events: RunEvent[] }>;
};

export type AppWorkbenchProps = {
  workflowApi: WorkbenchWorkflowApi;
  showDevModelProviders?: boolean;
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
