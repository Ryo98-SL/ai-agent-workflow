import { useMemo, useState } from "react";
import { AuthMenu, Toaster, ThemeProvider, WorkbenchDataProvider } from "@ai-agent-workflow/workbench-ui";
import type { WorkbenchWorkflowApi } from "@ai-agent-workflow/workbench-ui";
import { BookOpen, Database, LayoutDashboard } from "lucide-react";
import { HomepageShell } from "./HomepageShell";
import { KnowledgePanel } from "./KnowledgePanel";
import { StudioPanel } from "./StudioPanel";
import type { HomeTab } from "./types";

type ProductHomepageProps = {
  workflowApi: WorkbenchWorkflowApi;
  apiBaseUrl: string;
};

export function ProductHomepage({ workflowApi, apiBaseUrl }: ProductHomepageProps) {
  return (
    <ThemeProvider>
      <WorkbenchDataProvider workflowApi={workflowApi} apiBaseUrl={apiBaseUrl}>
        <HomepageRuntime />
      </WorkbenchDataProvider>
      <Toaster richColors closeButton position="bottom-right" />
    </ThemeProvider>
  );
}

function HomepageRuntime() {
  const [activeTab, setActiveTab] = useState<HomeTab>("studio");
  const tabs = useMemo(
    () => [
      { id: "studio" as const, label: "Studio", icon: LayoutDashboard },
      { id: "knowledge" as const, label: "Knowledge", icon: BookOpen },
    ],
    [],
  );

  return (
    <HomepageShell activeTab={activeTab} tabs={tabs} onTabChange={setActiveTab} accountSlot={<AuthMenu />}>
      {activeTab === "studio" ? <StudioPanel /> : <KnowledgePanel icon={Database} />}
    </HomepageShell>
  );
}
