import { type ComponentProps, useMemo, useState } from "react";
import { NewWorkflowDialog, useCreateWorkflow, useWorkflows, WorkflowIconGlyph } from "@ai-agent-workflow/workbench-ui";
import { Database, GitBranch, Loader2, Plus, TriangleAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SearchTagFilter } from "./SearchTagFilter";
import type { SearchTagFilterValue, StudioWorkflowCard } from "./types";

type WorkflowTemplateSelection = Parameters<ComponentProps<typeof NewWorkflowDialog>["onSelect"]>[0];

export function StudioPanel() {
  const navigate = useNavigate();
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
      setCreateWorkflowError(error instanceof Error ? error.message : "Workflow could not be created.");
    }
  }

  return (
    <section className="mx-auto max-w-[1680px]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-normal text-white sm:text-3xl">Studio</h1>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-white/42">
            Build workflows, connect knowledge, and return to the editor when a card needs deeper work.
          </p>
        </div>
        <div className="w-full min-w-0 lg:max-w-md">
          <SearchTagFilter value={filter} onChange={setFilter} />
        </div>
      </div>

      {createWorkflowError && (
        <div className="mt-5 rounded-lg border border-red-300/20 bg-red-300/10 px-4 py-3 text-sm font-medium text-red-100">
          {createWorkflowError}
        </div>
      )}

      <div className="mt-8 grid min-w-0 gap-5 md:grid-cols-2 2xl:grid-cols-4">
        <CreateWorkflowCard
          onOpen={() => {
            setCreateWorkflowError(null);
            setCreateOpen(true);
          }}
        />
        {workflowsQuery.isLoading && <StateCard icon={Loader2} title="Loading workflows" spinning />}
        {workflowsQuery.isError && <StateCard icon={TriangleAlert} title="Workflow list could not load" />}
        {!workflowsQuery.isLoading && !workflowsQuery.isError && filteredWorkflows.length === 0 && (
          <StateCard icon={GitBranch} title={workflows.length === 0 ? "No workflows yet" : "No matching workflows"} />
        )}
        {filteredWorkflows.map((workflow) => (
          <WorkflowCard key={workflow.id} workflow={workflow} />
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

function CreateWorkflowCard({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      className="group flex min-h-[226px] min-w-0 flex-col rounded-xl border border-white/10 bg-white/[0.04] p-6 text-left transition-colors hover:border-brand/45 hover:bg-white/[0.065]"
      onClick={onOpen}
    >
      <span className="flex size-16 items-center justify-center rounded-2xl bg-brand text-brand-foreground transition-transform group-hover:scale-105">
        <Plus size={36} strokeWidth={2.4} aria-hidden />
      </span>
      <span className="mt-6 block text-lg font-bold text-white">New workflow</span>
      <span className="mt-2 block max-w-sm text-sm font-medium leading-6 text-white/45">
        Choose a starter workflow or begin from a blank canvas.
      </span>
    </button>
  );
}

function WorkflowCard({ workflow }: { workflow: StudioWorkflowCard }) {
  const updated = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(
    new Date(workflow.updatedAt),
  );

  return (
    <a
      href={`/workbench?workflowId=${encodeURIComponent(workflow.id)}`}
      className="flex min-h-[226px] min-w-0 flex-col rounded-xl border border-white/10 bg-white/[0.035] p-6 transition-colors hover:border-white/22 hover:bg-white/[0.06]"
    >
      <div className="flex min-w-0 items-start gap-4">
        <span className="relative flex size-14 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground">
          <WorkflowIconGlyph icon={workflow.icon} size={27} />
          <span className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-lg border-2 border-[#202024] bg-brand text-[10px] font-bold text-brand-foreground">
            W
          </span>
        </span>
        <span className="min-w-0">
          <span className="block truncate text-lg font-bold tracking-normal text-white/86">{workflow.name}</span>
          <span className="mt-1 block truncate text-sm font-semibold text-white/38">Edited {updated}</span>
        </span>
      </div>

      {workflow.description && <p className="mt-5 line-clamp-2 text-sm font-medium leading-6 text-white/45">{workflow.description}</p>}

      <span className="mt-auto flex min-w-0 flex-wrap items-center gap-2 pt-5 text-xs font-bold uppercase text-white/38">
        <span className="rounded-md border border-white/10 px-2 py-1">{workflow.nodeCount} nodes</span>
        <span className="rounded-md border border-white/10 px-2 py-1">{workflow.edgeCount} edges</span>
      </span>
    </a>
  );
}

function StateCard({ icon: Icon, title, spinning = false }: { icon: typeof Database; title: string; spinning?: boolean }) {
  return (
    <div className="flex min-h-[226px] min-w-0 flex-col items-center justify-center rounded-xl border border-dashed border-white/12 bg-white/[0.025] p-6 text-center">
      <Icon size={26} className={spinning ? "animate-spin text-white/50" : "text-white/45"} aria-hidden />
      <p className="mt-3 text-sm font-semibold text-white/55">{title}</p>
    </div>
  );
}
