import type { Dispatch, SetStateAction } from "react";
import type { RuntimeResult, RuntimeStatus } from "../domain/runtime/types";
import type { OpenAICompatibleSettings, WorkflowFile, WorkflowNode, WorkflowNodeType } from "../domain/workflow/schema";

export type DebugState = {
  status: RuntimeStatus;
  result?: RuntimeResult;
  error?: string;
};

export type WorkflowMutators = {
  setWorkflow: Dispatch<SetStateAction<WorkflowFile>>;
  updateNode: (nodeId: string, updater: (node: WorkflowNode) => WorkflowNode) => void;
  updateModelSettings: (settings: OpenAICompatibleSettings) => void;
  addNode: (type: WorkflowNodeType) => void;
};
