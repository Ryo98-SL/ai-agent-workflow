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
  children: ReactNode;
};

export function HomepageShell({
  activeTab,
  tabs,
  onTabChange,
  accountSlot,
  brandAriaLabel,
  sectionsAriaLabel,
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
    </div>
  );
}
