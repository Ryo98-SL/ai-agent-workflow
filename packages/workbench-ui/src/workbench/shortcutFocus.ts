/**
 * Focus predicates that decide whether a global keyboard shortcut should act on
 * the workflow (graph history, node copy/paste/duplicate) or fall through to the
 * browser's native behaviour. Extracted from `AppWorkbench` so the gating rules
 * are unit-testable in isolation.
 */

/** True when the event target is a text field where shortcuts must stay native. */
export function isWorkflowShortcutEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable || target.closest("[contenteditable='true']")) {
    return true;
  }

  const tagName = target.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true;
  }

  const role = target.getAttribute("role");
  return role === "textbox" || role === "combobox" || role === "searchbox";
}

/**
 * True when keyboard focus sits on the canvas rather than a side panel (e.g. the
 * Node Inspector). Selecting a node doesn't move focus into a focusable element,
 * so default `body`/`html` focus counts as the canvas; anything inside ReactFlow
 * does too. Focus inside the inspector (or any other panel) does not — so the
 * node copy/paste/duplicate shortcuts there fall through to native behaviour.
 *
 * A live text selection also disqualifies the canvas: if the user has selected
 * text anywhere (e.g. a variable reference in the inspector) ⌘C should copy that
 * text, not the node. ReactFlow node selection is its own state and leaves the
 * DOM selection collapsed, so this doesn't block the normal copy-node case.
 */
export function isWorkflowCanvasFocus(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const selection = typeof window !== "undefined" ? window.getSelection() : null;
  if (selection && !selection.isCollapsed && selection.toString().length > 0) {
    return false;
  }
  return (
    target === document.body ||
    target === document.documentElement ||
    target.closest(".react-flow") !== null
  );
}
