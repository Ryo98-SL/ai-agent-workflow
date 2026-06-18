import { type ComponentProps, useMemo, useState } from "react";
import { formatDateForLocale, useProductLocale, useTranslation, type SupportedLocale } from "@ai-agent-workflow/i18n";
import { NewWorkflowDialog, useCreateWorkflow, useWorkflows, WorkflowIconGlyph } from "@ai-agent-workflow/workbench-ui";
import { Database, GitBranch, Loader2, Plus, TriangleAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SearchTagFilter } from "./SearchTagFilter";
import type { SearchTagFilterValue, StudioWorkflowCard } from "./types";

type WorkflowTemplateSelection = Parameters<ComponentProps<typeof NewWorkflowDialog>["onSelect"]>[0];

export function StudioPanel() {
  const navigate = useNavigate();
  const { locale } = useProductLocale();
  const { t } = useTranslation("web");
  const workflowsQuery = useWorkflows();
  const createWorkflow = useCreateWorkflow();
  const [filter, setFilter] = useState<SearchTagFilterValue>({ query: "" });
  const [createOpen, setCreateOpen] = useState(false);
  const [createWorkflowError, setCreateWorkflowError] = useState<string | null>(null);
  const workflows = useMemo<StudioWorkflowCard[]>(() => {
    return (workflowsQuery.data?.workflows ?? []).map((workflow) => ({
      ...workflow,
      searchableText: [
        workflow.name,
        workflow.description ?? "",
        workflow.icon ?? "",
        workflow.nodeCount > 0 ? "workflow" : "draft",
        workflow.edgeCount > 0 ? "connected" : "new",
      ]
        .join(" ")
        .toLowerCase(),
    }));
  }, [workflowsQuery.data?.workflows]);
  const filteredWorkflows = useMemo(() => filterWorkflows(workflows, filter), [workflows, filter]);

  async function handleSelectTemplate(template: WorkflowTemplateSelection) {
    if (createWorkflow.isPending) {
      return;
    }

    setCreateWorkflowError(null);
    try {
      const { workflow } = await createWorkflow.mutateAsync(template.build());
      setCreateOpen(false);
      navigate(`/workbench?workflowId=${encodeURIComponent(workflow.id)}`);
    } catch (error) {
      setCreateWorkflowError(error instanceof Error ? error.message : t("homepage.studio.createError"));
    }
  }

  return (
    <section className="mx-auto max-w-[1680px]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-normal text-foreground sm:text-3xl">{t("homepage.studio.title")}</h1>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-muted-foreground">
            {t("homepage.studio.description")}
          </p>
        </div>
        <div className="w-full min-w-0 lg:max-w-md">
          <SearchTagFilter
            value={filter}
            onChange={setFilter}
            label={t("homepage.studio.searchLabel")}
            placeholder={t("homepage.studio.searchPlaceholder")}
            clearLabel={t("homepage.studio.clearSearch")}
          />
        </div>
      </div>

      {createWorkflowError && (
        <div className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {createWorkflowError}
        </div>
      )}

      <div className="mt-6 grid min-w-0 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <CreateWorkflowCard
          title={t("homepage.studio.createTitle")}
          description={t("homepage.studio.createDescription")}
          onOpen={() => {
            setCreateWorkflowError(null);
            setCreateOpen(true);
          }}
        />
        {workflowsQuery.isLoading && <StateCard icon={Loader2} title={t("homepage.studio.loading")} spinning />}
        {workflowsQuery.isError && <StateCard icon={TriangleAlert} title={t("homepage.studio.loadError")} />}
        {!workflowsQuery.isLoading && !workflowsQuery.isError && filteredWorkflows.length === 0 && (
          <StateCard icon={GitBranch} title={workflows.length === 0 ? t("homepage.studio.empty") : t("homepage.studio.noMatches")} />
        )}
        {filteredWorkflows.map((workflow) => (
          <WorkflowCard key={workflow.id} workflow={workflow} locale={locale} />
        ))}
      </div>

      <NewWorkflowDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSelect={(template) => {
          void handleSelectTemplate(template);
        }}
      />
    </section>
  );
}

function filterWorkflows(workflows: StudioWorkflowCard[], filter: SearchTagFilterValue) {
  const query = filter.query.trim().toLowerCase();
  return workflows.filter((workflow) => {
    return !query || workflow.searchableText.includes(query);
  });
}

function CreateWorkflowCard({ title, description, onOpen }: { title: string; description: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      className="group flex min-h-[178px] min-w-0 flex-col rounded-xl border border-border bg-card p-5 text-left shadow-sm transition-colors hover:border-brand/45 hover:bg-brand/5"
      onClick={onOpen}
    >
      <span className="flex size-12 items-center justify-center rounded-xl bg-brand text-brand-foreground transition-transform group-hover:scale-105">
        <Plus size={28} strokeWidth={2.4} aria-hidden />
      </span>
      <span className="mt-5 block text-base font-bold text-foreground">{title}</span>
      <span className="mt-2 block max-w-sm text-sm font-medium leading-6 text-muted-foreground">{description}</span>
    </button>
  );
}

function WorkflowCard({ workflow, locale }: { workflow: StudioWorkflowCard; locale: SupportedLocale }) {
  const { t } = useTranslation("web");
  const updated = formatDateForLocale(locale, workflow.updatedAt, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <a
      href={`/workbench?workflowId=${encodeURIComponent(workflow.id)}`}
      className="flex min-h-[178px] min-w-0 flex-col rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-brand/35 hover:bg-accent"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground">
          <WorkflowIconGlyph icon={workflow.icon} size={23} />
        </span>
          <span className="min-w-0">
            <span className="block truncate text-base font-bold tracking-normal text-foreground">{workflow.name}</span>
          <span className="mt-1 block truncate text-sm font-semibold text-muted-foreground">
            {t("homepage.studio.edited", { date: updated })}
          </span>
          </span>
      </div>

      {workflow.description && <p className="mt-4 line-clamp-2 text-sm font-medium leading-6 text-muted-foreground">{workflow.description}</p>}

      <span className="mt-auto flex min-w-0 flex-wrap items-center gap-2 pt-4 text-xs font-bold uppercase text-muted-foreground">
        <span className="rounded-md border border-border bg-muted/40 px-2 py-1">
          {t("homepage.studio.nodeCount", { count: workflow.nodeCount })}
        </span>
        <span className="rounded-md border border-border bg-muted/40 px-2 py-1">
          {t("homepage.studio.edgeCount", { count: workflow.edgeCount })}
        </span>
      </span>
    </a>
  );
}

function StateCard({ icon: Icon, title, spinning = false }: { icon: typeof Database; title: string; spinning?: boolean }) {
  return (
    <div className="flex min-h-[178px] min-w-0 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 p-5 text-center">
      <Icon size={26} className={spinning ? "animate-spin text-muted-foreground" : "text-muted-foreground"} aria-hidden />
      <p className="mt-3 text-sm font-semibold text-muted-foreground">{title}</p>
    </div>
  );
}
