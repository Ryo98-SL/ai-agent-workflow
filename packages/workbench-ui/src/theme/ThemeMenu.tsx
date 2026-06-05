import { Check, Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "../workbench/components/Button";
import { Popover } from "../workbench/components/Popover";
import { useTheme, type ThemeMode } from "./ThemeProvider";

const OPTIONS: { mode: ThemeMode; label: string; icon: LucideIcon }[] = [
  { mode: "light", label: "Light", icon: Sun },
  { mode: "dark", label: "Dark", icon: Moon },
  { mode: "system", label: "System", icon: Monitor },
];

const MODE_ICON: Record<ThemeMode, LucideIcon> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

export function ThemeMenu() {
  const { mode, setMode } = useTheme();
  const [open, setOpen] = useState(false);
  const TriggerIcon = MODE_ICON[mode];

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      placement="bottom-end"
      renderTrigger={({ ref, props }) => (
        <Button
          {...props}
          ref={ref}
          variant="secondary"
          size="iconMd"
          onClick={() => setOpen((current) => !current)}
          aria-label="Switch theme"
          title="Switch theme"
        >
          <TriggerIcon size={16} aria-hidden />
        </Button>
      )}
    >
      <div className="min-w-[9rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          const active = option.mode === mode;
          return (
            <Button
              key={option.mode}
              variant="ghost"
              size="unstyled"
              fullWidth
              className="justify-start gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground hover:bg-accent hover:text-accent-foreground"
              onClick={() => {
                setMode(option.mode);
                setOpen(false);
              }}
            >
              <Icon size={16} aria-hidden />
              <span className="flex-1 text-left">{option.label}</span>
              {active && <Check size={15} className="text-brand" aria-hidden />}
            </Button>
          );
        })}
      </div>
    </Popover>
  );
}
