import { X } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { Button } from "./Button";

type FloatingPanelProps = {
  title: string;
  description?: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  headerContent?: ReactNode;
  /** Optional visual rendered to the left of the title (e.g. a node-type icon). */
  titleIcon?: ReactNode;
  /** Optional resize handle (e.g. a draggable edge) rendered inside the panel. */
  resizeHandle?: ReactNode;
};

export function FloatingPanel({
  title,
  description,
  closeLabel,
  onClose,
  children,
  className = "",
  style,
  headerContent,
  titleIcon,
  resizeHandle,
}: FloatingPanelProps) {
  return (
    <aside
      style={style}
      className={[
        "flex flex-col overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-xl shadow-black/20",
        className,
      ].join(" ")}
    >
      {resizeHandle}
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        {headerContent ?? (
          <div className="flex min-w-0 items-center gap-2.5">
            {titleIcon}
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
              {description && <p className="truncate text-xs leading-3 text-muted-foreground">{description}</p>}
            </div>
          </div>
        )}
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
