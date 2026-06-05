import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, ChevronsUpDown, Clock, Command, FilePlus2, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@workbench/workbench/components/Button";
import { Popover } from "@workbench/workbench/components/Popover";
import { FIELD_SHELL_CLASS, FIELD_SHELL_INPUT_CLASS } from "@workbench/workbench/components/fieldStyles";
import { ThemeProvider } from "@workbench/theme/ThemeProvider";
import { ThemeMenu } from "@workbench/theme/ThemeMenu";

/**
 * Design exploration (not wired into the product).
 *
 * Problem: a user now has multiple workflows (per-account when signed in,
 * per-browser when anonymous), but the workbench only ever loads the first one
 * — there is no way to see the list or switch between them. Three switcher
 * patterns are mocked below so we can compare before building one for real.
 */

type WorkflowItem = {
  id: string;
  name: string;
  nodeCount: number;
  updatedLabel: string;
};

const MOCK: WorkflowItem[] = [
  { id: "w1", name: "Support triage agent", nodeCount: 6, updatedLabel: "2m ago" },
  { id: "w2", name: "Blog draft pipeline", nodeCount: 4, updatedLabel: "1h ago" },
  { id: "w3", name: "PR reviewer", nodeCount: 9, updatedLabel: "yesterday" },
  { id: "w4", name: "Untitled Agent Workflow", nodeCount: 2, updatedLabel: "3 days ago" },
  { id: "w5", name: "Lead enrichment", nodeCount: 7, updatedLabel: "last week" },
];

function useFiltered(query: string) {
  const q = query.trim().toLowerCase();
  return useMemo(() => (q === "" ? MOCK : MOCK.filter((w) => w.name.toLowerCase().includes(q))), [q]);
}

export function WorkflowListDesignGallery() {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background text-foreground">
        <header className="flex items-center gap-3 border-b border-border px-6 py-3">
          <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft size={15} /> Workbench
          </Link>
          <h1 className="text-sm font-semibold">Workflow list — design options</h1>
          <div className="ml-auto">
            <ThemeMenu />
          </div>
        </header>

        <div className="mx-auto max-w-5xl space-y-12 px-6 py-10">
          <Proposal
            title="A · Header switcher (Popover)"
            blurb="The workbench title becomes a picker. Smallest footprint, always one click away — like a document/project switcher. Best when the canvas should stay full-bleed."
          >
            <HeaderSwitcherMock />
          </Proposal>

          <Proposal
            title="B · Left sidebar list"
            blurb="A persistent (collapsible) rail. Most discoverable, shows more metadata at a glance, supports inline rename/delete. Costs ~240px of horizontal space."
          >
            <SidebarMock />
          </Proposal>

          <Proposal
            title="C · Command palette (⌘K modal)"
            blurb="A search-first modal. Zero persistent space, scales to many workflows, keyboard-driven. Switching is a two-step (open → pick)."
          >
            <CommandPaletteMock />
          </Proposal>
        </div>
      </div>
    </ThemeProvider>
  );
}

function Proposal({ title, blurb, children }: { title: string; blurb: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">{blurb}</p>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">{children}</div>
    </section>
  );
}

/** A mock workbench frame so each option is shown in context. */
function AppFrame({ children, canvas }: { children: ReactNode; canvas?: ReactNode }) {
  return (
    <div className="h-[320px] bg-background">
      <div className="flex h-12 items-center gap-3 border-b border-border bg-card/95 px-4">
        <div className="flex size-8 items-center justify-center rounded-md bg-brand text-brand-foreground">
          <FilePlus2 size={16} />
        </div>
        {children}
      </div>
      <div className="relative h-[calc(320px-3rem)]">
        {canvas ?? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">workflow canvas</div>
        )}
      </div>
    </div>
  );
}

// --- A. Header switcher -----------------------------------------------------

function HeaderSwitcherMock() {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState("w1");
  const [query, setQuery] = useState("");
  const filtered = useFiltered(query);
  const active = MOCK.find((w) => w.id === activeId) ?? MOCK[0];

  return (
    <AppFrame>
      <Popover
        open={open}
        onOpenChange={setOpen}
        placement="bottom-start"
        renderTrigger={({ ref, props }) => (
          <Button
            {...props}
            ref={ref}
            variant="ghost"
            size="unstyled"
            className="-ml-1 flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 hover:bg-accent"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="truncate text-sm font-semibold">{active.name}</span>
            <ChevronsUpDown size={14} className="shrink-0 text-muted-foreground" />
          </Button>
        )}
      >
        <div className="w-[320px] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-xl">
          <div className="border-b border-border p-2">
            <label className={FIELD_SHELL_CLASS}>
              <Search size={14} className="text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search workflows"
                className={FIELD_SHELL_INPUT_CLASS}
              />
            </label>
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.map((w) => (
              <button
                key={w.id}
                onClick={() => {
                  setActiveId(w.id);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <span className="min-w-0 flex-1 truncate">{w.name}</span>
                <span className="text-[11px] text-muted-foreground">{w.updatedLabel}</span>
                {w.id === activeId && <Check size={15} className="text-brand" />}
              </button>
            ))}
          </div>
          <div className="border-t border-border p-1">
            <Button variant="ghost" size="unstyled" fullWidth className="justify-start gap-2 px-2 py-2 text-sm text-brand">
              <Plus size={15} /> New workflow
            </Button>
          </div>
        </div>
      </Popover>
      <p className="ml-1 truncate text-xs text-muted-foreground">{active.nodeCount} nodes · saved {active.updatedLabel}</p>
    </AppFrame>
  );
}

// --- B. Sidebar -------------------------------------------------------------

function SidebarMock() {
  const [activeId, setActiveId] = useState("w1");
  const [query, setQuery] = useState("");
  const filtered = useFiltered(query);

  return (
    <div className="flex h-[320px] bg-background">
      <aside className="flex w-[240px] shrink-0 flex-col border-r border-border bg-card/50">
        <div className="flex items-center justify-between px-3 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Workflows</span>
          <Button variant="secondary" size="iconMd" aria-label="New workflow" className="size-7">
            <Plus size={15} />
          </Button>
        </div>
        <div className="px-2 pb-2">
          <label className={FIELD_SHELL_CLASS}>
            <Search size={14} className="text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className={FIELD_SHELL_INPUT_CLASS}
            />
          </label>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {filtered.map((w) => {
            const active = w.id === activeId;
            return (
              <div
                key={w.id}
                onClick={() => setActiveId(w.id)}
                className={[
                  "group mb-1 cursor-pointer rounded-md border px-2.5 py-2",
                  active ? "border-brand/40 bg-brand/10" : "border-transparent hover:bg-accent",
                ].join(" ")}
              >
                <div className="flex items-center gap-1.5">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{w.name}</span>
                  <button
                    aria-label="Delete"
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Trash2 size={13} className="text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{w.nodeCount} nodes</span>
                  <span className="flex items-center gap-0.5">
                    <Clock size={10} /> {w.updatedLabel}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </aside>
      <div className="flex-1">
        <div className="flex h-12 items-center gap-3 border-b border-border bg-card/95 px-4">
          <div className="flex size-8 items-center justify-center rounded-md bg-brand text-brand-foreground">
            <FilePlus2 size={16} />
          </div>
          <span className="text-sm font-semibold">{MOCK.find((w) => w.id === activeId)?.name}</span>
        </div>
        <div className="flex h-[calc(320px-3rem)] items-center justify-center text-xs text-muted-foreground">
          workflow canvas
        </div>
      </div>
    </div>
  );
}

// --- C. Command palette -----------------------------------------------------

function CommandPaletteMock() {
  const [open, setOpen] = useState(true);
  const [activeId, setActiveId] = useState("w1");
  const [query, setQuery] = useState("");
  const filtered = useFiltered(query);
  const active = MOCK.find((w) => w.id === activeId) ?? MOCK[0];

  return (
    <AppFrame
      canvas={
        open ? (
          <div className="absolute inset-0 flex items-start justify-center bg-black/40 pt-10">
            <div className="w-[440px] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl">
              <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
                <Search size={16} className="text-muted-foreground" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search or create a workflow…"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">esc</kbd>
              </div>
              <div className="max-h-60 overflow-y-auto p-1.5">
                <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Recent</p>
                {filtered.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => {
                      setActiveId(w.id);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
                  >
                    <FilePlus2 size={15} className="text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{w.name}</span>
                    <span className="text-[11px] text-muted-foreground">{w.nodeCount} nodes</span>
                  </button>
                ))}
                <button className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-brand hover:bg-accent">
                  <Plus size={15} /> Create “{query || "new workflow"}”
                </button>
              </div>
            </div>
          </div>
        ) : undefined
      }
    >
      <span className="text-sm font-semibold">{active.name}</span>
      <Button variant="secondary" size="sm" className="ml-auto gap-1.5" onClick={() => setOpen(true)}>
        <Command size={13} /> Open <kbd className="rounded bg-muted px-1 text-[10px]">K</kbd>
      </Button>
    </AppFrame>
  );
}
