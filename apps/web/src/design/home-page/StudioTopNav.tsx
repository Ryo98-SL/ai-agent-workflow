import { BookOpen, ChevronDown, LayoutDashboard } from "lucide-react";

export function StudioTopNav() {
  return (
    <header className="flex h-[72px] items-center border-b border-white/10 bg-[#19191d] px-5 text-[#f7f7f8]">
      <div className="flex min-w-0 items-center gap-3">
        <div className="text-[32px] font-bold leading-none tracking-normal">AIW</div>
        <span className="text-xl text-white/20">/</span>
        <div className="flex size-9 items-center justify-center rounded-lg bg-[#2563eb] text-sm font-semibold text-white">R</div>
        <button type="button" className="flex min-w-0 items-center gap-1.5 text-base font-semibold text-white/75 hover:text-white">
          <span className="truncate">Ryo&apos;s Workspace</span>
          <ChevronDown size={16} className="text-white/45" />
        </button>
      </div>

      <nav className="mx-auto hidden items-center gap-7 md:flex">
        <TopTab icon={LayoutDashboard} label="Studio" active />
        <TopTab icon={BookOpen} label="Knowledge" />
      </nav>

      <div className="ml-auto flex items-center gap-4">
        <div className="hidden rounded-lg bg-[#2563eb] px-3 py-2 text-sm font-semibold text-white shadow-sm sm:block">Upgrade</div>
        <div className="flex size-12 items-center justify-center rounded-full bg-[#2563eb] text-lg font-semibold text-white">R</div>
      </div>
    </header>
  );
}

function TopTab({ icon: Icon, label, active = false }: { icon: typeof LayoutDashboard; label: string; active?: boolean }) {
  return (
    <button
      type="button"
      className={[
        "flex h-12 items-center gap-2 rounded-md px-4 text-lg font-semibold transition-colors",
        active
          ? "border border-[#8fc2ff] bg-white/10 text-white shadow-[0_0_0_2px_rgba(96,165,250,0.35)]"
          : "text-white/40 hover:text-white/70",
      ].join(" ")}
    >
      <Icon size={20} />
      {label}
    </button>
  );
}
