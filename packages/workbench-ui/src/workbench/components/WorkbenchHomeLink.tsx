type WorkbenchHomeLinkProps = {
  href: string;
  label: string;
};

export function WorkbenchHomeLink({ href, label }: WorkbenchHomeLinkProps) {
  return (
    <a
      href={href}
      aria-label={label}
      className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand text-xs font-black tracking-normal text-brand-foreground transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      AIW
    </a>
  );
}
