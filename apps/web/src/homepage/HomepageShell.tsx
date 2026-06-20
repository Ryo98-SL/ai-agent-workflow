import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { HomeTab } from "./types";

type HomepageShellProps = {
  activeTab: HomeTab;
  tabs: Array<{ id: HomeTab; label: string; icon: LucideIcon }>;
  onTabChange: (tab: HomeTab) => void;
  accountSlot: ReactNode;
  brandAriaLabel: string;
  sectionsAriaLabel: string;
  githubLabel: string;
  children: ReactNode;
};

export function HomepageShell({
  activeTab,
  tabs,
  onTabChange,
  accountSlot,
  brandAriaLabel,
  sectionsAriaLabel,
  githubLabel,
  children,
}: HomepageShellProps) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <header className="sticky top-0 z-20 grid min-h-[72px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 border-b border-border bg-card/95 px-4 shadow-sm backdrop-blur sm:px-6 lg:px-10">
        <a
          href="/"
          className="flex min-w-0 items-center gap-3 justify-self-start text-foreground"
          aria-label={brandAriaLabel}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand text-sm font-black text-brand-foreground">
            AIW
          </span>
          <span className="hidden text-sm font-semibold text-muted-foreground sm:inline">AI Agent Workflow</span>
        </a>

        <nav className="flex min-w-0 items-center justify-center gap-2 justify-self-center" aria-label={sectionsAriaLabel}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={[
                  "flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors sm:px-4",
                  active
                    ? "border-brand/55 bg-brand/10 text-brand shadow-[0_0_0_2px_hsl(var(--brand)/0.18)]"
                    : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
                ].join(" ")}
                onClick={() => onTabChange(tab.id)}
              >
                <Icon size={17} aria-hidden />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex min-w-[11.5rem] shrink-0 items-center justify-end justify-self-end">{accountSlot}</div>
      </header>

      <main className="min-h-[calc(100vh-72px)] bg-muted/30 px-4 py-8 sm:px-6 lg:px-10 xl:px-14">{children}</main>
      <a
        href="https://github.com/Ryo98-SL/ai-agent-workflow"
        target="_blank"
        rel="noreferrer"
        aria-label={githubLabel}
        title={githubLabel}
        className="fixed bottom-4 left-4 z-30 inline-flex size-5 items-center justify-center overflow-hidden rounded-full bg-white text-black opacity-45 shadow-lg shadow-black/10 transition hover:scale-105 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:bottom-6 sm:left-6"
      >
        <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
          <path
            fill="currentColor"
            d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.6 7.6 0 0 1 8 3.86c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
          />
        </svg>
      </a>
    </div>
  );
}
