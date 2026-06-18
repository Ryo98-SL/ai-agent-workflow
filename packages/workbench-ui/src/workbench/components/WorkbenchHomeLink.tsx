import { ArrowLeft } from "lucide-react";

type WorkbenchHomeLinkProps = {
  href: string;
  label: string;
};

export function WorkbenchHomeLink({ href, label }: WorkbenchHomeLinkProps) {
  return (
    <a
      href={href}
      aria-label={label}
      className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:border-brand/40 hover:bg-brand/10 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <ArrowLeft size={15} aria-hidden />
    </a>
  );
}
