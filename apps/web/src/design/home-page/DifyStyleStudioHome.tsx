import { FileInput } from "lucide-react";
import { StudioAppCard } from "./StudioAppCard";
import { StudioCreateCard } from "./StudioCreateCard";
import { StudioFilterBar } from "./StudioFilterBar";
import { studioApps } from "./studioData";
import { StudioTopNav } from "./StudioTopNav";

export function DifyStyleStudioHome() {
  return (
    <div className="min-h-screen bg-[#18181c] text-white">
      <StudioTopNav />
      <main className="px-5 py-10 sm:px-8 lg:px-[68px]">
        <StudioFilterBar />

        <div className="mt-10 grid min-w-0 gap-6 lg:grid-cols-2 2xl:grid-cols-4">
          <StudioCreateCard />
          {studioApps.map((app) => (
            <StudioAppCard key={app.id} app={app} />
          ))}
        </div>

        <div className="pointer-events-none fixed inset-x-0 bottom-6 hidden justify-center text-sm font-semibold text-white/20 md:flex">
          <div className="flex items-center gap-2">
            <FileInput size={18} />
            Drop DSL file here to create app
          </div>
        </div>
      </main>
    </div>
  );
}
