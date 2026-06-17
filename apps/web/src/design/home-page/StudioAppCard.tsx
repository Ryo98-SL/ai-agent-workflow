import { Tag } from "lucide-react";
import type { StudioApp } from "./studioData";

export function StudioAppCard({ app }: { app: StudioApp }) {
  const Icon = app.icon;

  return (
    <article className="flex min-h-[226px] min-w-0 flex-col rounded-2xl border border-white/7 bg-white/[0.035] p-6">
      <div className="flex min-w-0 items-start gap-4">
        <div className="relative flex size-14 shrink-0 items-center justify-center rounded-xl bg-[#ffe9d6] text-[#1f2937]">
          <Icon size={28} />
          <span className={["absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-lg border-2 border-[#202024] text-[10px] font-bold text-white", app.accent].join(" ")}>
            {app.type.slice(0, 1)}
          </span>
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-xl font-bold tracking-normal text-white/82">{app.name}</h3>
          <p className="mt-1 truncate text-sm font-semibold text-white/35">
            {app.owner} · Edited at {app.editedAt}
          </p>
        </div>
      </div>

      <div className="mt-auto">
        <button
          type="button"
          className="flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-white/18 px-2 text-xs font-bold uppercase text-white/38 hover:border-white/35 hover:text-white/65"
        >
          <Tag size={14} />
          Add tags
        </button>
      </div>
    </article>
  );
}
