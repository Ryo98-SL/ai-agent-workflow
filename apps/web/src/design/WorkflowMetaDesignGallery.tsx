import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Bot,
  Brain,
  ChevronsUpDown,
  Code,
  Database,
  FileText,
  GitPullRequest,
  type LucideIcon,
  Mail,
  MessageSquare,
  Pencil,
  Search,
  Sparkles,
  Workflow as WorkflowIcon,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@workbench/workbench/components/Button";
import { Popover } from "@workbench/workbench/components/Popover";
import { Input } from "@workbench/components/ui/input";
import { Textarea } from "@workbench/components/ui/textarea";
import { Label } from "@workbench/components/ui/label";
import { ThemeProvider } from "@workbench/theme/ThemeProvider";
import { ThemeMenu } from "@workbench/theme/ThemeMenu";

/**
 * Design exploration (not wired into the product).
 *
 * Goal: let a user rename a workflow, edit its description, and pick an icon.
 * (Requires adding an optional `icon` to WorkflowFile.metadata.) Three editing
 * surfaces are mocked so we can compare before building one.
 */

const ICONS: Record<string, LucideIcon> = {
  bot: Bot,
  workflow: WorkflowIcon,
  chat: MessageSquare,
  doc: FileText,
  pr: GitPullRequest,
  sparkles: Sparkles,
  brain: Brain,
  zap: Zap,
  search: Search,
  db: Database,
  mail: Mail,
  code: Code,
};
const ICON_KEYS = Object.keys(ICONS);

type Meta = { icon: string; name: string; description: string };
const INITIAL: Meta = {
  icon: "bot",
  name: "Support triage agent",
  description: "Routes inbound tickets to the right queue and drafts a first reply.",
};

function IconGlyph({ name, size = 16 }: { name: string; size?: number }) {
  const Cmp = ICONS[name] ?? Bot;
  return <Cmp size={size} />;
}

export function WorkflowMetaDesignGallery() {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background text-foreground">
        <header className="flex items-center gap-3 border-b border-border px-6 py-3">
          <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft size={15} /> Workbench
          </Link>
          <h1 className="text-sm font-semibold">Workflow title / description / icon — design options</h1>
          <div className="ml-auto">
            <ThemeMenu />
          </div>
        </header>

        <div className="mx-auto max-w-5xl space-y-12 px-6 py-10">
          <Proposal
            title="1 · Inline popover (pairs with header switcher A)"
            blurb="A small edit affordance next to the title opens a compact popover: icon row + name + description, applied live. Lowest friction, stays in context."
          >
            <PopoverMock />
          </Proposal>

          <Proposal
            title="2 · Settings modal"
            blurb="A centered ‘Workflow settings’ dialog with a full icon grid and room to grow (metadata, danger-zone delete, created/updated). Best when there will be more fields."
          >
            <ModalMock />
          </Proposal>

          <Proposal
            title="3 · Click-to-edit header"
            blurb="The title is editable in place; the icon button opens a picker; the description is an editable subtitle. Most direct, zero extra chrome — but less discoverable."
          >
            <InlineHeaderMock />
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

function AppFrame({ children }: { children: ReactNode }) {
  return (
    <div className="h-[300px] bg-background">
      <div className="flex h-12 items-center gap-3 border-b border-border bg-card/95 px-4">{children}</div>
      <div className="flex h-[calc(300px-3rem)] items-center justify-center text-xs text-muted-foreground">
        workflow canvas
      </div>
    </div>
  );
}

function IconPicker({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  return (
    <div className="grid grid-cols-6 gap-1">
      {ICON_KEYS.map((key) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={[
            "flex aspect-square items-center justify-center rounded-md border",
            key === value ? "border-brand bg-brand/15 text-brand" : "border-border text-muted-foreground hover:bg-accent",
          ].join(" ")}
        >
          <IconGlyph name={key} size={16} />
        </button>
      ))}
    </div>
  );
}

// --- 1. Inline popover ------------------------------------------------------

function PopoverMock() {
  const [open, setOpen] = useState(false);
  const [meta, setMeta] = useState<Meta>(INITIAL);

  return (
    <AppFrame>
      <span className="flex size-8 items-center justify-center rounded-md bg-brand text-brand-foreground">
        <IconGlyph name={meta.icon} size={16} />
      </span>
      <div className="flex items-center gap-1">
        <span className="text-sm font-semibold">{meta.name}</span>
        <ChevronsUpDown size={13} className="text-muted-foreground" />
      </div>
      <Popover
        open={open}
        onOpenChange={setOpen}
        placement="bottom-start"
        renderTrigger={({ ref, props }) => (
          <Button
            {...props}
            ref={ref}
            variant="ghost"
            size="iconMd"
            className="size-7"
            aria-label="Edit workflow details"
            onClick={() => setOpen((v) => !v)}
          >
            <Pencil size={14} />
          </Button>
        )}
      >
        <div className="w-[320px] space-y-3 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-xl">
          <div className="space-y-1.5">
            <Label>Icon</Label>
            <IconPicker value={meta.icon} onChange={(icon) => setMeta((m) => ({ ...m, icon }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-name">Name</Label>
            <Input id="p-name" value={meta.name} onChange={(e) => setMeta((m) => ({ ...m, name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-desc">Description</Label>
            <Textarea
              id="p-desc"
              rows={3}
              value={meta.description}
              onChange={(e) => setMeta((m) => ({ ...m, description: e.target.value }))}
            />
          </div>
        </div>
      </Popover>
    </AppFrame>
  );
}

// --- 2. Settings modal ------------------------------------------------------

function ModalMock() {
  const [open, setOpen] = useState(true);
  const [meta, setMeta] = useState<Meta>(INITIAL);

  return (
    <div className="relative h-[520px] bg-background">
      <div className="flex h-12 items-center gap-3 border-b border-border bg-card/95 px-4">
        <span className="flex size-8 items-center justify-center rounded-md bg-brand text-brand-foreground">
          <IconGlyph name={meta.icon} size={16} />
        </span>
        <span className="text-sm font-semibold">{meta.name}</span>
        <Button variant="secondary" size="sm" className="ml-auto gap-1.5" onClick={() => setOpen(true)}>
          <Pencil size={13} /> Edit details
        </Button>
      </div>

      {open && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 p-4">
          <div className="w-[460px] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">Workflow settings</h3>
              <Button variant="ghost" size="iconMd" aria-label="Close" onClick={() => setOpen(false)}>
                <X size={15} />
              </Button>
            </div>
            <div className="space-y-4 p-4">
              <div className="flex gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground">
                  <IconGlyph name={meta.icon} size={22} />
                </span>
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="m-name">Name</Label>
                  <Input id="m-name" value={meta.name} onChange={(e) => setMeta((m) => ({ ...m, name: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Icon</Label>
                <IconPicker value={meta.icon} onChange={(icon) => setMeta((m) => ({ ...m, icon }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-desc">Description</Label>
                <Textarea
                  id="m-desc"
                  rows={3}
                  value={meta.description}
                  onChange={(e) => setMeta((m) => ({ ...m, description: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
              <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="success" size="sm" onClick={() => setOpen(false)}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- 3. Click-to-edit header ------------------------------------------------

function InlineHeaderMock() {
  const [meta, setMeta] = useState<Meta>(INITIAL);
  const [iconOpen, setIconOpen] = useState(false);

  return (
    <AppFrame>
      <Popover
        open={iconOpen}
        onOpenChange={setIconOpen}
        placement="bottom-start"
        renderTrigger={({ ref, props }) => (
          <Button
            {...props}
            ref={ref}
            variant="ghost"
            size="unstyled"
            aria-label="Change icon"
            className="flex size-8 items-center justify-center rounded-md bg-brand text-brand-foreground hover:opacity-90"
            onClick={() => setIconOpen((v) => !v)}
          >
            <IconGlyph name={meta.icon} size={16} />
          </Button>
        )}
      >
        <div className="w-[220px] rounded-lg border border-border bg-popover p-2 shadow-xl">
          <IconPicker
            value={meta.icon}
            onChange={(icon) => {
              setMeta((m) => ({ ...m, icon }));
              setIconOpen(false);
            }}
          />
        </div>
      </Popover>

      <div className="min-w-0 flex-1">
        <input
          value={meta.name}
          onChange={(e) => setMeta((m) => ({ ...m, name: e.target.value }))}
          className="w-full truncate rounded bg-transparent px-1 text-sm font-semibold outline-none hover:bg-accent focus:bg-accent focus:ring-1 focus:ring-brand"
          aria-label="Workflow name"
        />
        <input
          value={meta.description}
          onChange={(e) => setMeta((m) => ({ ...m, description: e.target.value }))}
          placeholder="Add a description…"
          className="w-full truncate rounded bg-transparent px-1 text-xs text-muted-foreground outline-none hover:bg-accent focus:bg-accent focus:ring-1 focus:ring-brand"
          aria-label="Workflow description"
        />
      </div>
    </AppFrame>
  );
}
