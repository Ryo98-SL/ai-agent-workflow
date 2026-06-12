import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

type UseResizableWidthOptions = {
  /** localStorage key the chosen width is persisted under. */
  storageKey: string;
  defaultWidth: number;
  min: number;
  max: number;
  /**
   * Which edge carries the drag handle. For a right-anchored panel the handle is
   * on the `left` edge: dragging left (smaller clientX) widens it.
   */
  edge?: "left" | "right";
};

function readStored(storageKey: string, fallback: number, min: number, max: number): number {
  if (typeof window === "undefined") {
    return fallback;
  }
  const raw = window.localStorage.getItem(storageKey);
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

/**
 * Pointer-drag width control for a side panel. Returns the current `width`, an
 * `onPointerDown` to wire to a resize handle, and `isDragging` for cursor/overlay
 * styling. The width is clamped to `[min, max]` and persisted to localStorage.
 */
export function useResizableWidth({ storageKey, defaultWidth, min, max, edge = "left" }: UseResizableWidthOptions) {
  const [width, setWidth] = useState(() => readStored(storageKey, defaultWidth, min, max));
  const [isDragging, setIsDragging] = useState(false);
  const dragState = useRef<{ startX: number; startWidth: number } | null>(null);

  const onPointerMove = useCallback(
    (event: globalThis.PointerEvent) => {
      const state = dragState.current;
      if (!state) {
        return;
      }
      const rawDelta = event.clientX - state.startX;
      // Left handle on a right-anchored panel: moving left should widen.
      const delta = edge === "left" ? -rawDelta : rawDelta;
      setWidth(Math.min(max, Math.max(min, state.startWidth + delta)));
    },
    [edge, max, min],
  );

  const endDrag = useCallback(() => {
    if (!dragState.current) {
      return;
    }
    dragState.current = null;
    setIsDragging(false);
  }, []);

  // Persist whenever the width settles (cheap; one write per change).
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, String(Math.round(width)));
    }
  }, [storageKey, width]);

  useEffect(() => {
    if (!isDragging) {
      return;
    }
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    // Avoid text selection / cursor flicker while dragging.
    const previousCursor = document.body.style.cursor;
    const previousSelect = document.body.style.userSelect;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousSelect;
    };
  }, [isDragging, onPointerMove, endDrag]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent) => {
      event.preventDefault();
      dragState.current = { startX: event.clientX, startWidth: width };
      setIsDragging(true);
    },
    [width],
  );

  return { width, onPointerDown, isDragging };
}
