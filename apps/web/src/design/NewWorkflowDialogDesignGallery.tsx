import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@workbench/workbench/components/Button";
import { Badge } from "@workbench/components/ui/badge";
import { WorkflowIconGlyph } from "@workbench/workbench/components/workflowIcons";
import { ThemeProvider } from "@workbench/theme/ThemeProvider";
import { ThemeMenu } from "@workbench/theme/ThemeMenu";

/**
 * Design exploration (not wired into the product).
 *
 * "New workflow" should open a picker of real, runnable examples (plus a blank
 * start). Three dialog layouts are mocked below so we can compare before
 * building one for real. Data mirrors the `WORKFLOW_TEMPLATES` registry.
 */

type TemplateMock = {
  id: string;
  name: string;
  description: string;
  icon: string;
  tags: string[];
  requires: ("credits" | "auth")[];
  flow: string[];
};

const TEMPLATES: TemplateMock[] = [
  {
    id: "blank",
    name: "从空白开始",
    description: "一个 Start → LLM 的最小工作流，从零搭建。",
    icon: "plus",
    tags: [],
    requires: [],
    flow: ["Start", "LLM"],
  },
  {
    id: "support-rag",
    name: "云舵客服 RAG",
    description: "基于示例知识库的中文客服问答：问题经知识检索后再生成回答。",
    icon: "bot",
    tags: ["RAG"],
    requires: ["credits"],
    flow: ["Start", "Knowledge", "LLM"],
  },
  {
    id: "support-hitl",
    name: "客服机器人（含人工复核）",
    description: "退款/投诉类问题自动转人工复核，其余自动回复；基于示例知识库，带对话记忆。",
    icon: "userCheck",
    tags: ["RAG", "分支", "人工复核", "记忆"],
    requires: ["credits"],
    flow: ["Start", "Knowledge", "LLM", "If/Else", "人工复核 / 自动回复"],
  },
];

function RequiresBadge({ requires }: { requires: TemplateMock["requires"] }) {
  if (requires.includes("credits")) {
    return (
      <Badge variant="secondary" className="shrink-0">
        需登录 · credits
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="shrink-0 border-brand/40 text-brand">
      可直接运行
    </Badge>
  );
}

function TagRow({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span key={tag} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {tag}
        </span>
      ))}
    </div>
  );
}

function FlowPills({ flow }: { flow: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
      {flow.map((step, index) => (
        <span key={step} className="flex items-center gap-1">
          <span className="rounded border border-border bg-card px-1.5 py-0.5">{step}</span>
          {index < flow.length - 1 && <span className="text-muted-foreground/60">→</span>}
        </span>
      ))}
    </div>
  );
}

function IconTile({ icon }: { icon: string }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand text-brand-foreground">
      <WorkflowIconGlyph icon={icon} size={18} />
    </span>
  );
}

/** V1 — card grid. */
function GridVariant() {
  return (
    <DialogShell title="新建工作流" subtitle="选择一个示例开始，或从空白搭建。">
      <div className="grid grid-cols-2 gap-3">
        {TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-brand hover:bg-accent"
          >
            <div className="flex items-center gap-2">
              <IconTile icon={template.icon} />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{template.name}</span>
              <RequiresBadge requires={template.requires} />
            </div>
            <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">{template.description}</p>
            <TagRow tags={template.tags} />
          </button>
        ))}
      </div>
    </DialogShell>
  );
}

/** V2 — left list + right preview (recommended). */
function ListPreviewVariant() {
  const [selectedId, setSelectedId] = useState(TEMPLATES[2].id);
  const selected = TEMPLATES.find((template) => template.id === selectedId)!;
  return (
    <DialogShell title="新建工作流" subtitle="选择一个示例开始，或从空白搭建。">
      <div className="flex h-[300px] gap-4">
        <div className="w-56 shrink-0 space-y-1 overflow-y-auto border-r border-border pr-3">
          {TEMPLATES.map((template) => {
            const active = template.id === selectedId;
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => setSelectedId(template.id)}
                className={[
                  "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors",
                  active ? "bg-accent" : "hover:bg-accent/60",
                ].join(" ")}
              >
                <IconTile icon={template.icon} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{template.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{template.description}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2">
            <IconTile icon={selected.icon} />
            <h3 className="min-w-0 flex-1 truncate text-base font-semibold">{selected.name}</h3>
            <RequiresBadge requires={selected.requires} />
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{selected.description}</p>
          <div className="mt-4 space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">流程</span>
            <FlowPills flow={selected.flow} />
          </div>
          <div className="mt-3">
            <TagRow tags={selected.tags} />
          </div>
          <div className="mt-auto flex justify-end pt-4">
            <Button variant="success" size="md">使用此示例</Button>
          </div>
        </div>
      </div>
    </DialogShell>
  );
}

/** V3 — compact rows. */
function CompactVariant() {
  return (
    <DialogShell title="新建工作流" subtitle="选择一个示例开始，或从空白搭建。">
      <div className="space-y-1.5">
        {TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            className="flex w-full items-center gap-3 rounded-md border border-border bg-card px-3 py-2 text-left transition-colors hover:border-brand hover:bg-accent"
          >
            <IconTile icon={template.icon} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{template.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{template.description}</span>
            </span>
            <RequiresBadge requires={template.requires} />
          </button>
        ))}
      </div>
    </DialogShell>
  );
}

function DialogShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="w-[680px] max-w-full rounded-xl border border-border bg-background p-5 shadow-lg">
      <div className="mb-4">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

export function NewWorkflowDialogDesignGallery() {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background text-foreground">
        <header className="flex items-center gap-3 border-b border-border px-6 py-3">
          <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft size={15} /> Workbench
          </Link>
          <h1 className="text-sm font-semibold">New workflow picker — design options</h1>
          <div className="ml-auto">
            <ThemeMenu />
          </div>
        </header>

        <div className="mx-auto max-w-5xl space-y-12 px-6 py-10">
          <Proposal
            title="V1 · 卡片网格"
            blurb="2 列卡片，图标 + 标题 + 描述 + 标签 + 徽章。一眼看全，适合示例较少时。"
          >
            <GridVariant />
          </Proposal>
          <Proposal
            title="V2 · 左列表 + 右预览（推荐）"
            blurb="左选示例，右看完整说明 / 流程 / 标签 / 可运行性 + 行动按钮。信息量最适合「真实示例」，扩展性好。"
          >
            <ListPreviewVariant />
          </Proposal>
          <Proposal
            title="V3 · 紧凑列表"
            blurb="单行卡片，密度最高。适合示例很多时快速扫读。"
          >
            <CompactVariant />
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
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{blurb}</p>
      </div>
      <div className="flex justify-center rounded-lg border border-dashed border-border bg-muted/30 p-6">{children}</div>
    </section>
  );
}
