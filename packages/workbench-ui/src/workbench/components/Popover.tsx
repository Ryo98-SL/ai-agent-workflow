import {
  FloatingPortal,
  autoUpdate,
  flip,
  offset as floatingOffset,
  shift,
  size as floatingSize,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
  type Placement,
} from "@floating-ui/react";
import { useEffect, useId, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

type PopoverTriggerProps = {
  ref: (node: HTMLButtonElement | null) => void;
  props: ButtonHTMLAttributes<HTMLButtonElement>;
};

type PopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  renderTrigger?: (props: PopoverTriggerProps) => ReactNode;
  children: ReactNode;
  id?: string;
  placement?: Placement;
  offset?: number;
  className?: string;
  matchReferenceWidth?: boolean;
  /**
   * Stretch the floating element to fill the available space between the trigger
   * and the viewport edge (in the placement direction). The height is recomputed
   * on every reposition via the floating-ui `size` middleware, so the panel bottom
   * stays flush with the window bottom as it resizes.
   */
  fillAvailableHeight?: boolean;
  /** Gap (px) left between the filled floating element and the viewport edge. */
  availableHeightPadding?: number;
  preserveNestedPopoverPress?: boolean;
  referenceElement?: HTMLElement | null;
};

const VIEWPORT_PADDING = 12;

export function Popover({
  open,
  onOpenChange,
  renderTrigger,
  children,
  id,
  placement = "bottom-start",
  offset = 8,
  className = "",
  matchReferenceWidth = false,
  fillAvailableHeight = false,
  availableHeightPadding = 12,
  preserveNestedPopoverPress = true,
  referenceElement,
}: PopoverProps) {
  const generatedId = useId();
  const contentId = id || generatedId;
  const [triggerReferenceElement, setTriggerReferenceElement] = useState<HTMLButtonElement | null>(null);
  const [floatingElement, setFloatingElement] = useState<HTMLDivElement | null>(null);
  const activeReferenceElement = referenceElement ?? triggerReferenceElement;
  const middleware = [
    floatingOffset(offset),
    // When filling height we always want the panel to stay below the trigger and
    // grow downward, so we skip `flip` (which would otherwise flip it upward once
    // its natural height overflows the viewport before `size` constrains it).
    ...(fillAvailableHeight ? [] : [flip()]),
    shift({ padding: VIEWPORT_PADDING }),
    floatingSize({
      padding: fillAvailableHeight ? availableHeightPadding : VIEWPORT_PADDING,
      apply({ availableHeight, availableWidth, elements, rects }) {
        const constrainedHeight = `${Math.max(0, Math.floor(availableHeight))}px`;
        const constrainedWidth = `${Math.max(0, Math.floor(availableWidth))}px`;
        const referenceWidth = `${Math.max(0, Math.floor(Math.min(rects.reference.width, availableWidth)))}px`;

        Object.assign(elements.floating.style, {
          height: fillAvailableHeight ? constrainedHeight : "",
          maxHeight: fillAvailableHeight ? "" : constrainedHeight,
          maxWidth: constrainedWidth,
          overflow: fillAvailableHeight ? "" : "auto",
          width: matchReferenceWidth ? referenceWidth : "",
        });
      },
    }),
  ];
  const { context, floatingStyles, update } = useFloating({
    elements: {
      floating: floatingElement,
      reference: activeReferenceElement,
    },
    middleware,
    onOpenChange,
    open,
    placement,
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
  });
  const dismiss = useDismiss(context, {
    outsidePress: (event) => {
      const target = event.target instanceof Element ? event.target : null;
      return !preserveNestedPopoverPress || !target?.closest("[data-workbench-popover]");
    },
  });
  const role = useRole(context, { role: "dialog" });
  const { getFloatingProps, getReferenceProps } = useInteractions([dismiss, role]);

  useEffect(() => {
    if (open) {
      void update();
    }
  }, [activeReferenceElement, floatingElement, open, update]);

  return (
    <>
      {renderTrigger?.({
        ref: setTriggerReferenceElement,
        props: getReferenceProps({
          "aria-controls": open ? contentId : undefined,
          "aria-expanded": open,
        }) as ButtonHTMLAttributes<HTMLButtonElement>,
      })}
      {open && (
        <FloatingPortal>
          <div
            {...getFloatingProps({
              className: ["z-[100]", className].filter(Boolean).join(" "),
              id: contentId,
              style: floatingStyles,
            })}
            ref={setFloatingElement}
            data-workbench-popover
          >
            {children}
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
