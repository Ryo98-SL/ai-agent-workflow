import { useState } from "react";
import { useTranslation } from "@ai-agent-workflow/i18n";
import { CreateKnowledgeBaseDialog } from "@ai-agent-workflow/workbench-ui";
import { Plus, type LucideIcon } from "lucide-react";

type KnowledgePanelProps = {
  icon: LucideIcon;
};

export function KnowledgePanel({ icon: Icon }: KnowledgePanelProps) {
  const { t } = useTranslation("web");
  const [createOpen, setCreateOpen] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  return (
    <section className="mx-auto max-w-[1680px]">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-normal text-foreground sm:text-3xl">{t("homepage.knowledge.title")}</h1>
        <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-muted-foreground">
          {t("homepage.knowledge.description")}
        </p>
      </div>

      <div className="mt-6 grid min-w-0 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <button
          type="button"
          className="group flex min-h-[178px] min-w-0 flex-col rounded-xl border border-border bg-card p-5 text-left shadow-sm transition-colors hover:border-brand/45 hover:bg-brand/5"
          onClick={() => setCreateOpen(true)}
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
