/// <reference types="vite/client" />

type WorkflowOpenResult =
  | { ok: true; filePath: string; content: string }
  | { ok: false; canceled?: boolean; error?: string };

type WorkflowSaveResult =
  | { ok: true; filePath: string }
  | { ok: false; canceled?: boolean; error?: string };

interface Window {
  agentWorkflow?: {
    openWorkflow: () => Promise<WorkflowOpenResult>;
    saveWorkflow: (filePath: string, content: string) => Promise<WorkflowSaveResult>;
    saveWorkflowAs: (content: string, defaultPath?: string) => Promise<WorkflowSaveResult>;
  };
}
