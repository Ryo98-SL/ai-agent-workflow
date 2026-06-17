import { CheckSquare, Search, Tag } from "lucide-react";
import { studioCategories } from "./studioData";

export function StudioFilterBar() {
  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex flex-wrap items-center gap-4">
        {studioCategories.map((category) => {
          const Icon = category.icon;
          return (
            <button
              key={category.label}
              type="button"
              className={[
                "flex h-12 items-center gap-2 rounded-xl px-4 text-base font-semibold transition-colors",
                category.active ? "bg-white/8 text-white" : "text-white/38 hover:bg-white/5 hover:text-white/65",
              ].join(" ")}
            >
              <Icon size={18} />
              {category.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="flex h-12 items-center gap-3 rounded-xl px-2 text-base font-semibold text-white/80">
          <span className="flex size-6 items-center justify-center rounded-md border border-white/35">
            <CheckSquare size={14} className="opacity-0" />
          </span>
          Created by me
        </button>

        <button type="button" className="flex h-12 items-center gap-2 rounded-xl bg-white/8 px-4 text-base font-semibold text-white/65">
          <Tag size={18} />
          All Tags
        </button>

        <label className="flex h-12 w-full min-w-0 items-center gap-2 rounded-xl bg-white/8 px-4 text-base text-white/35 sm:w-[284px]">
          <Search size={20} />
          <input className="min-w-0 flex-1 bg-transparent font-medium outline-none placeholder:text-white/28" placeholder="Search" />
        </label>
      </div>
    </div>
  );
}
