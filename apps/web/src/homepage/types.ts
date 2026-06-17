import type { WorkbenchWorkflowApi } from "@ai-agent-workflow/workbench-ui";

export type HomeTab = "studio" | "knowledge";

export type SearchTagFilterValue = {
  query: string;
};

export type SearchTagFilterVariant = "inline";

type WorkflowSummary = Awaited<ReturnType<WorkbenchWorkflowApi["listWorkflows"]>>["workflows"][number];

export type StudioWorkflowCard = WorkflowSummary & {
  searchableText: string;
};
