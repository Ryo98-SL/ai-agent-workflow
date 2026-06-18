import { useMemo, useState } from "react";
import { useTranslation } from "@ai-agent-workflow/i18n";
import { CreateKnowledgeBaseDialog, useKnowledgeBases } from "@ai-agent-workflow/workbench-ui";
import { FileText, Loader2, Plus, TriangleAlert, type LucideIcon } from "lucide-react";
import { KnowledgeBaseCardActions } from "./KnowledgeBaseCardActions";
import { SearchTagFilter } from "./SearchTagFilter";
import type { KnowledgeBaseCard, SearchTagFilterValue } from "./types";

type KnowledgePanelProps = {
  icon: LucideIcon;
};

export function KnowledgePanel({ icon: Icon }: KnowledgePanelProps) {
  const { t } = useTranslation("web");
  const knowledgeBasesQuery = useKnowledgeBases();
  const [createOpen, setCreateOpen] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [knowledgeActionError, setKnowledgeActionError] = useState<string | null>(null);
  const [filter, setFilter] = useState<SearchTagFilterValue>({ query: "" });
  const knowledgeBases = useMemo<KnowledgeBaseCard[]>(() => {
    return (knowledgeBasesQuery.data?.knowledgeBases ?? []).map((knowledgeBase) => ({
      ...knowledgeBase,
      searchableText: [
        knowledgeBase.name,
        knowledgeBase.description ?? "",
        knowledgeBase.visibility,
        knowledgeBase.readOnly ? "readonly" : "editable",
      ]
        .join(" ")
        .toLowerCase(),
    }));
  }, [knowledgeBasesQuery.data?.knowledgeBases]);
  const filteredKnowledgeBases = useMemo(
    () => filterKnowledgeBases(knowledgeBases, filter),
    [knowledgeBases, filter],
  );

  return (
    <section className="mx-auto max-w-[1680px]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-normal text-foreground sm:text-3xl">{t("homepage.knowledge.title")}</h1>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-muted-foreground">
            {t("homepage.knowledge.description")}
          </p>
        </div>
        <div className="w-full min-w-0 lg:max-w-md">
          <SearchTagFilter
            value={filter}
            onChange={setFilter}
            label={t("homepage.knowledge.searchLabel")}
            placeholder={t("homepage.knowledge.searchPlaceholder")}
            clearLabel={t("homepage.knowledge.clearSearch")}
          />
        </div>
      </div>

      {knowledgeActionError && (
        <div className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {knowledgeActionError}
        </div>
      )}

      <div className="mt-6 grid min-w-0 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <button
          type="button"
          className="group flex min-h-[178px] min-w-0 flex-col rounded-xl border border-border bg-card p-5 text-left shadow-sm transition-colors hover:border-brand/45 hover:bg-brand/5"
          onClick={() => {
            setKnowledgeActionError(null);
            setCreateOpen(true);
          }}
        >
          <span className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Icon size={23} aria-hidden />
          </span>
          <span className="mt-5 flex items-center gap-2 text-base font-bold text-foreground">
            <Plus size={18} aria-hidden />
            {t("homepage.knowledge.createTitle")}
          </span>
          <span className="mt-2 max-w-sm text-sm font-medium leading-6 text-muted-foreground">
            {t("homepage.knowledge.createDescription")}
          </span>
        </button>
        {knowledgeBasesQuery.isLoading && <StateCard icon={Loader2} title={t("homepage.knowledge.loading")} spinning />}
        {knowledgeBasesQuery.isError && <StateCard icon={TriangleAlert} title={t("homepage.knowledge.loadError")} />}
        {!knowledgeBasesQuery.isLoading && !knowledgeBasesQuery.isError && filteredKnowledgeBases.length === 0 && (
          <StateCard
            icon={Icon}
            title={knowledgeBases.length === 0 ? t("homepage.knowledge.empty") : t("homepage.knowledge.noMatches")}
          />
        )}
        {filteredKnowledgeBases.map((knowledgeBase) => (
          <KnowledgeBaseCardView
            key={knowledgeBase.id}
            knowledgeBase={knowledgeBase}
            icon={Icon}
            onActionError={setKnowledgeActionError}
          />
        ))}
      </div>

      {createdId && (
        <div className="mt-5 rounded-lg border border-brand/30 bg-brand/10 px-4 py-3 text-sm font-medium text-brand">
          {t("homepage.knowledge.created", { id: createdId })}
        </div>
      )}

      <CreateKnowledgeBaseDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => {
          setCreatedId(id);
          setCreateOpen(false);
        }}
      />
    </section>
  );
}

function filterKnowledgeBases(knowledgeBases: KnowledgeBaseCard[], filter: SearchTagFilterValue) {
  const query = filter.query.trim().toLowerCase();
  return knowledgeBases.filter((knowledgeBase) => {
    return !query || knowledgeBase.searchableText.includes(query);
  });
}

function KnowledgeBaseCardView({
  knowledgeBase,
  icon: Icon,
  onActionError,
}: {
  knowledgeBase: KnowledgeBaseCard;
  icon: LucideIcon;
  onActionError: (message: string | null) => void;
}) {
  const { t } = useTranslation("web");

  return (
    <article className="group/card relative flex min-h-[178px] min-w-0 flex-col rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-brand/45 hover:bg-brand/5 focus-within:border-brand/45 focus-within:bg-brand/5">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Icon size={23} aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-base font-bold tracking-normal text-foreground">{knowledgeBase.name}</span>
          <span className="mt-1 block truncate text-sm font-semibold text-muted-foreground">
            {knowledgeBase.readOnly ? t("homepage.knowledge.readOnly") : t("homepage.knowledge.editable")}
          </span>
        </span>
      </div>

      {knowledgeBase.description && (
        <p className="mt-4 line-clamp-2 text-sm font-medium leading-6 text-muted-foreground">
          {knowledgeBase.description}
        </p>
      )}

      <span className="mt-auto flex min-w-0 flex-wrap items-center gap-2 pt-4 pr-12 text-xs font-bold uppercase text-muted-foreground">
        <span className="rounded-md border border-border bg-muted/40 px-2 py-1">
          <FileText size={12} className="mr-1 inline-block align-[-2px]" aria-hidden />
          {t("homepage.knowledge.documentCount", { count: knowledgeBase.documentCount })}
        </span>
        <span className="rounded-md border border-border bg-muted/40 px-2 py-1">
          {t("homepage.knowledge.characterCount", { count: knowledgeBase.characterCount.toLocaleString() })}
        </span>
      </span>
      <KnowledgeBaseCardActions knowledgeBase={knowledgeBase} onActionError={onActionError} />
    </article>
  );
}

function StateCard({ icon: Icon, title, spinning = false }: { icon: LucideIcon; title: string; spinning?: boolean }) {
  return (
    <div className="flex min-h-[178px] min-w-0 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 p-5 text-center">
      <Icon size={26} className={spinning ? "animate-spin text-muted-foreground" : "text-muted-foreground"} aria-hidden />
      <p className="mt-3 text-sm font-semibold text-muted-foreground">{title}</p>
    </div>
  );
}
