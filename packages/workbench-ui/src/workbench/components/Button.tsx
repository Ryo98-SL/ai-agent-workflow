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
  "inline-flex shrink-0 items-center gap-2 rounded-md font-medium tracking-normal transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:cursor-not-allowed";

const variantClassNames: Record<ButtonVariant, string> = {
  primary: "justify-center bg-slate-900 text-white hover:bg-slate-700 disabled:bg-slate-300",
  secondary:
    "justify-center border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-100 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400",
  success: "justify-center bg-emerald-600 text-white hover:bg-emerald-500 disabled:bg-slate-300",
  successSoft:
    "justify-center border border-emerald-200 bg-white text-emerald-700 shadow-lg shadow-slate-900/10 hover:border-emerald-300 hover:bg-emerald-50 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400",
  ghost: "justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:text-slate-300",
  dangerGhost: "justify-center text-rose-600 hover:bg-rose-50 disabled:text-slate-300",
  modelTrigger:
    "h-12 w-full justify-start gap-3 rounded-lg border border-slate-200 bg-slate-950 px-3 text-left text-white shadow-sm hover:border-slate-400 disabled:bg-slate-800",
  modelOption: "h-10 w-full justify-start gap-3 text-left text-sm text-slate-200 hover:bg-slate-800 disabled:text-slate-500",
  nodePalette:
    "justify-start gap-3 border border-slate-200 bg-white p-3 text-left hover:border-emerald-300 hover:bg-emerald-50 disabled:bg-slate-100 disabled:text-slate-400",
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
