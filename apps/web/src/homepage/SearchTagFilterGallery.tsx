import { useState } from "react";
import { SearchTagFilter } from "./SearchTagFilter";
import type { SearchTagFilterValue } from "./types";

export function SearchTagFilterGallery() {
  const [value, setValue] = useState<SearchTagFilterValue>({ query: "support" });

  return (
    <div className="min-h-screen bg-[#17181c] px-5 py-8 text-white sm:px-8 lg:px-12">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-bold tracking-normal">Workflow search design</h1>
        <section className="mt-8 rounded-xl border border-white/10 bg-white/[0.035] p-5">
          <div className="mb-4">
            <h2 className="text-lg font-bold tracking-normal">Single-line search</h2>
            <p className="mt-1 text-sm font-medium text-white/42">
              Production search stays compact and only filters against workflow metadata that exists.
            </p>
          </div>
          <SearchTagFilter value={value} onChange={setValue} />
        </section>
      </div>
    </div>
  );
}
