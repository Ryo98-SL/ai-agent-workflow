import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button";

type FloatingPanelProps = {
  title: string;
  description?: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  /** Optional visual rendered to the left of the title (e.g. a node-type icon). */
  titleIcon?: ReactNode;
};

export function FloatingPanel({ title, description, closeLabel, onClose, children, className = "", titleIcon }: FloatingPanelProps) {
  return (
    <aside
      className={[
        "flex flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-xl shadow-slate-900/10",
        className,
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {titleIcon}
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-slate-950">{title}</h2>
            {description && <p className="truncate leading-3 text-xs text-slate-500">{description}</p>}
          </div>
        </div>
        <Button
          variant="ghost"
          size="iconSm"
          onClick={onClose}
          aria-label={closeLabel}
          title={closeLabel}
        >
          <X size={16} aria-hidden />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </aside>
  );
}
