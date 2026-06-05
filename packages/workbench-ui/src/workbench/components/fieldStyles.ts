/**
 * Shared form-field styling for the workbench panels, built on the shadcn design
 * tokens so every input's border, text, and focus ring follow the active theme
 * (light / dark / system).
 */

/** Plain inputs (passed to the shadcn `Input` via className; twMerge overrides defaults when needed). */
export const FIELD_INPUT_CLASS = "border-input bg-transparent text-foreground placeholder:text-muted-foreground focus-visible:ring-brand";

/** Wrapper shell for inputs that carry an adornment (icon / capability tags). */
export const FIELD_SHELL_CLASS =
  "flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm transition-colors focus-within:outline-none focus-within:ring-1 focus-within:ring-brand";

/** Inner input for adornment shells: transparent so the shell owns the border + focus ring. */
export const FIELD_SHELL_INPUT_CLASS = "h-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground";
