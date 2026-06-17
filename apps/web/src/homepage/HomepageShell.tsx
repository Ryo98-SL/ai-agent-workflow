import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { HomeTab } from "./types";

type HomepageShellProps = {
  activeTab: HomeTab;
  tabs: Array<{ id: HomeTab; label: string; icon: LucideIcon }>;
  onTabChange: (tab: HomeTab) => void;
  accountSlot: ReactNode;
  children: ReactNode;
};

export function HomepageShell({ activeTab, tabs, onTabChange, accountSlot, children }: HomepageShellProps) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#17181c] text-white">
      <header className="sticky top-0 z-20 flex min-h-[72px] items-center gap-4 border-b border-white/10 bg-[#18191e]/95 px-4 backdrop-blur sm:px-6 lg:px-10">
        <a href="/" className="flex min-w-0 items-center gap-3 text-white" aria-label="AI Agent Workflow home">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand text-sm font-black text-brand-foreground">
            AIW
          </span>
          <span className="hidden text-sm font-semibold text-white/55 sm:inline">AI Agent Workflow</span>
        </a>

        <nav className="mx-auto flex min-w-0 items-center justify-center gap-2" aria-label="Product sections">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={[
                  "flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors sm:px-4",
                  active
                    ? "border border-brand/55 bg-brand/10 text-white shadow-[0_0_0_2px_hsl(var(--brand)/0.18)]"
                    : "text-white/45 hover:bg-white/5 hover:text-white/75",
                ].join(" ")}
                onClick={() => onTabChange(tab.id)}
              >
                <Icon size={17} aria-hidden />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center justify-end">{accountSlot}</div>
      </header>

      <main className="px-4 py-8 sm:px-6 lg:px-10 xl:px-14">{children}</main>
    </div>
  );
}
