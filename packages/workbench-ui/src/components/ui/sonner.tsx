import type { CSSProperties } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

import { useTheme } from "../../theme/ThemeProvider";

/**
 * App-themed Sonner toaster. Bridges the workbench {@link useTheme} provider to
 * Sonner and maps its surface tokens onto our `hsl(var(--token))` palette so
 * toasts match the active light/dark theme.
 */
function Toaster(props: ToasterProps) {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={resolvedTheme}
      className="toaster group"
      style={
        {
          "--normal-bg": "hsl(var(--popover))",
          "--normal-text": "hsl(var(--popover-foreground))",
          "--normal-border": "hsl(var(--border))",
        } as CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
