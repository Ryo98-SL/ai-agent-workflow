import { forwardRef, type ButtonHTMLAttributes } from "react";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "success"
  | "successSoft"
  | "ghost"
  | "dangerGhost"
  | "modelTrigger"
  | "modelOption"
  | "nodePalette";

type ButtonSize = "sm" | "md" | "lg" | "iconSm" | "iconMd" | "icon" | "iconLg" | "unstyled";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
};

const baseClassName =
  "inline-flex shrink-0 items-center gap-2 rounded-md font-medium tracking-normal transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed";

const variantClassNames: Record<ButtonVariant, string> = {
  primary: "justify-center bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50",
  secondary:
    "justify-center border border-border bg-card text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50",
  success: "justify-center bg-brand text-brand-foreground hover:bg-brand/90 disabled:opacity-50",
  successSoft:
    "justify-center border border-brand/30 bg-card text-brand hover:border-brand/50 hover:bg-brand/10 disabled:opacity-50",
  ghost: "justify-center text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50",
  dangerGhost: "justify-center text-destructive hover:bg-destructive/10 disabled:opacity-50",
  modelTrigger:
    "h-12 w-full justify-start gap-3 rounded-lg border border-input bg-transparent px-3 text-left text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50",
  modelOption: "h-10 w-full justify-start gap-3 text-left text-sm text-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50",
  nodePalette:
    "justify-start gap-3 border border-border bg-card p-3 text-left hover:border-brand/40 hover:bg-brand/10 disabled:opacity-50",
};

const sizeClassNames: Record<ButtonSize, string> = {
  sm: "h-8 px-2 text-xs",
  md: "h-9 px-3 text-sm",
  lg: "h-10 px-4 text-sm",
  iconSm: "h-8 w-8 justify-center p-0",
  iconMd: "h-9 w-9 justify-center p-0",
  icon: "h-10 w-10 justify-center p-0",
  iconLg: "h-12 w-12 justify-center p-0",
  unstyled: "",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", fullWidth = false, size = "md", type = "button", variant = "secondary", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={[
        baseClassName,
        variantClassNames[variant],
        sizeClassNames[size],
        fullWidth ? "w-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  ),
);

Button.displayName = "Button";
