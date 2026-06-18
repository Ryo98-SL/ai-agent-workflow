import type { WorkbenchWorkflowApi } from "@ai-agent-workflow/workbench-ui";

export type HomeTab = "studio" | "knowledge";

export type SearchTagFilterValue = {
  query: string;
};

export type SearchTagFilterVariant = "inline";

type WorkflowSummary = Awaited<ReturnType<WorkbenchWorkflowApi["listWorkflows"]>>["workflows"][number];
type KnowledgeBaseSummary = Awaited<ReturnType<WorkbenchWorkflowApi["listKnowledgeBases"]>>["knowledgeBases"][number];

export type StudioWorkflowCard = WorkflowSummary & {
  searchableText: string;
};

export type KnowledgeBaseCard = KnowledgeBaseSummary & {
  searchableText: string;
};
