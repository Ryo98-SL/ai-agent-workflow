import { KeyboardEvent, useId, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import type { SearchTagFilterValue, SearchTagFilterVariant } from "./types";

type SearchTagFilterProps = {
  value: SearchTagFilterValue;
  onChange: (value: SearchTagFilterValue) => void;
  placeholder?: string;
  variant?: SearchTagFilterVariant;
};

export function SearchTagFilter({
  value,
  onChange,
  placeholder = "Search workflows",
}: SearchTagFilterProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  const setQuery = (query: string) => onChange({ ...value, query });

  const clearAll = () => onChange({ query: "" });

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape" && value.query) {
      event.preventDefault();
      clearAll();
    }
  };

  return (
    <div
      className={[
        "min-w-0 rounded-lg border bg-white/[0.055] transition-colors",
        focused ? "border-brand/70 shadow-[0_0_0_3px_hsl(var(--brand)/0.18)]" : "border-white/10",
      ].join(" ")}
      onClick={() => inputRef.current?.focus()}
    >
      <label className="sr-only" htmlFor={inputId}>
        Search workflows
      </label>
      <div className="flex h-11 min-w-0 items-center gap-2 px-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-white/8 text-white/55">
          <Search size={17} aria-hidden />
        </span>

        <input
          ref={inputRef}
          id={inputId}
          value={value.query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="h-full min-w-0 flex-1 bg-transparent text-sm font-medium text-white outline-none placeholder:text-white/30"
          placeholder={placeholder}
        />

        {value.query && (
          <button
            type="button"
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-white/45 hover:bg-white/8 hover:text-white"
            onClick={(event) => {
              event.stopPropagation();
              clearAll();
            }}
            aria-label="Clear search"
          >
            <X size={16} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
