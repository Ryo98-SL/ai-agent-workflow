import { createActions } from "./studioData";

export function StudioCreateCard() {
  return (
    <section className="min-h-[226px] min-w-0 rounded-2xl border border-white/7 bg-white/[0.035] px-6 py-7 sm:px-12">
      <h2 className="text-base font-bold uppercase tracking-normal text-white/45">Create App</h2>
      <div className="mt-5 flex flex-col gap-5">
        {createActions.map((action) => {
          const Icon = action.icon;
          return (
            <button key={action.label} type="button" className="flex items-center gap-4 text-left text-lg font-semibold text-white/40 hover:text-white/80">
              <Icon size={22} />
              {action.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
