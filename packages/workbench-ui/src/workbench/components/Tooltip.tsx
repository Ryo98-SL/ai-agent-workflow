import {
  FloatingPortal,
  autoUpdate,
  flip,
  offset as floatingOffset,
  shift,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole,
  type Placement,
} from "@floating-ui/react";
import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";

type TooltipProps = {
  /** Floating content shown while the trigger is hovered or focused. */
  content: ReactNode;
  /** The trigger element (typically a small icon button). */
  children: ReactNode;
  placement?: Placement;
  offset?: number;
  /** Class applied to the floating surface wrapper. */
  className?: string;
};

const VIEWPORT_PADDING = 12;
const OPEN_DELAY_MS = 150;

/**
 * Hover/focus tooltip built on Floating UI (`role="tooltip"`). This is the
 * non-interactive sibling of `Popover` — which is a click-driven `role="dialog"`
 * surface — so passive hints anchored to a small trigger don't have to abuse the
 * dialog primitive. Keyboard focus opens it too, and it dismisses on Escape /
 * blur. Keep interactive menus and forms on `Popover`.
 */
export function Tooltip({ content, children, placement = "top-end", offset = 6, className = "" }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const { refs, context, floatingStyles } = useFloating({
    open,
    onOpenChange: setOpen,
    placement,
    strategy: "fixed",
    middleware: [floatingOffset(offset), flip(), shift({ padding: VIEWPORT_PADDING })],
    whileElementsMounted: autoUpdate,
  });
  const hover = useHover(context, { delay: { open: OPEN_DELAY_MS, close: 0 }, move: false });
  const focus = useFocus(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "tooltip" });
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, dismiss, role]);

  return (
    <>
      <span ref={refs.setReference} {...(getReferenceProps() as ButtonHTMLAttributes<HTMLSpanElement>)} className="inline-flex">
        {children}
      </span>
      {open && (
        <FloatingPortal>
          <div
            {...getFloatingProps({
              className: ["z-[100]", className].filter(Boolean).join(" "),
              style: floatingStyles,
            })}
            ref={refs.setFloating}
            data-workbench-tooltip
          >
            {content}
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
