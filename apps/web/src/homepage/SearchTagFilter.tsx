import { KeyboardEvent, useId } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@workbench/components/ui/input";
import type { SearchTagFilterValue, SearchTagFilterVariant } from "./types";

type SearchTagFilterProps = {
  value: SearchTagFilterValue;
  onChange: (value: SearchTagFilterValue) => void;
  placeholder?: string;
  label: string;
  clearLabel: string;
  variant?: SearchTagFilterVariant;
};

export function SearchTagFilter({
  value,
  onChange,
  placeholder,
  label,
  clearLabel,
}: SearchTagFilterProps) {
  const inputId = useId();
  const setQuery = (query: string) => onChange({ ...value, query });

  const clearAll = () => onChange({ query: "" });

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape" && value.query) {
      event.preventDefault();
      clearAll();
    }
  };

  return (
    <div className="relative min-w-0">
      <label className="sr-only" htmlFor={inputId}>
        {label}
      </label>
      <span className="pointer-events-none absolute left-3 top-1/2 z-10 flex size-7 -translate-y-1/2 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Search size={17} aria-hidden />
      </span>

      <Input
        id={inputId}
        value={value.query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={onKeyDown}
        className="h-11 rounded-lg border-border bg-card py-0 pl-12 pr-12 text-sm font-medium text-foreground shadow-none placeholder:text-muted-foreground/60"
        placeholder={placeholder}
      />

      {value.query && (
        <button
          type="button"
          className="absolute right-3 top-1/2 z-10 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={clearAll}
          aria-label={clearLabel}
        >
          <X size={16} aria-hidden />
        </button>
      )}
    </div>
  );
}
