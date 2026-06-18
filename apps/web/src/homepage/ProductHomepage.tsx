import { useMemo, useState } from "react";
import { useTranslation } from "@ai-agent-workflow/i18n";
import {
  AuthMenu,
  ImportLocalDataPrompt,
  ThemeMenu,
  Toaster,
  ThemeProvider,
  WorkbenchDataProvider,
} from "@ai-agent-workflow/workbench-ui";
import type { WorkbenchWorkflowApi } from "@ai-agent-workflow/workbench-ui";
import { BookOpen, Database, LayoutDashboard } from "lucide-react";
import { HomepageShell } from "./HomepageShell";
import { KnowledgePanel } from "./KnowledgePanel";
import { LanguageSwitcher } from "./LanguageSwitcher";
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
        <ImportLocalDataPrompt />
        <HomepageRuntime />
      </WorkbenchDataProvider>
      <Toaster richColors closeButton position="bottom-right" />
    </ThemeProvider>
  );
}

function HomepageRuntime() {
  const [activeTab, setActiveTab] = useState<HomeTab>("studio");
  const { t } = useTranslation("web");
  const tabs = useMemo(
    () => [
      { id: "studio" as const, label: t("homepage.tabs.studio"), icon: LayoutDashboard },
      { id: "knowledge" as const, label: t("homepage.tabs.knowledge"), icon: BookOpen },
    ],
    [t],
  );

  return (
    <HomepageShell
      activeTab={activeTab}
      tabs={tabs}
      onTabChange={setActiveTab}
      brandAriaLabel={t("homepage.brandAria")}
      sectionsAriaLabel={t("homepage.sectionsAria")}
      accountSlot={
        <div className="flex min-w-0 items-center justify-end gap-2">
          <LanguageSwitcher />
          <ThemeMenu />
          <AuthMenu />
        </div>
      }
    >
      {activeTab === "studio" ? <StudioPanel /> : <KnowledgePanel icon={Database} />}
    </HomepageShell>
  );
}
