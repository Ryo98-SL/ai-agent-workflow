import { useState } from "react";
import { CreateKnowledgeBaseDialog } from "@ai-agent-workflow/workbench-ui";
import { Plus, type LucideIcon } from "lucide-react";

type KnowledgePanelProps = {
  icon: LucideIcon;
};

export function KnowledgePanel({ icon: Icon }: KnowledgePanelProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  return (
    <section className="mx-auto max-w-[1680px]">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-normal text-white sm:text-3xl">Knowledge</h1>
        <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-white/42">
          Create reusable retrieval sources for workflow knowledge nodes.
        </p>
      </div>

      <div className="mt-8 grid min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-3">
        <button
          type="button"
          className="group flex min-h-[226px] min-w-0 flex-col rounded-xl border border-white/10 bg-white/[0.04] p-6 text-left transition-colors hover:border-sky-300/45 hover:bg-white/[0.065]"
          onClick={() => setCreateOpen(true)}
        >
          <span className="flex size-14 items-center justify-center rounded-xl bg-white/8 text-white/70">
            <Icon size={27} aria-hidden />
          </span>
          <span className="mt-6 flex items-center gap-2 text-lg font-bold text-white">
            <Plus size={20} aria-hidden />
            New knowledge base
          </span>
          <span className="mt-2 max-w-sm text-sm font-medium leading-6 text-white/45">
            Name the source, tune retrieval, and attach text or Markdown documents.
          </span>
        </button>
      </div>

      {createdId && (
        <div className="mt-5 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm font-medium text-emerald-100">
          Knowledge base created. ID: {createdId}
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
