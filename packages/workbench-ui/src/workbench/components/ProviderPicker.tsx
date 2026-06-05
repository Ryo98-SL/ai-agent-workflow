import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Button } from "./Button";
import type { ProviderOption } from "./modelCatalog";
import { ModelProviderLogo } from "./modelProviderVisuals";
import { Popover } from "./Popover";

type ProviderPickerProps = {
  id: string;
  providers: ProviderOption[];
  value: ProviderOption;
  onChange: (provider: ProviderOption) => void;
};

/**
 * Provider chooser built on the shared workbench `Popover` so it nests cleanly
 * inside another popover (the `outsidePress` guard keeps the parent open) and
 * renders each provider's logo — unlike a portal-based native select.
 */
export function ProviderPicker({ id, providers, value, onChange }: ProviderPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover
      id={id}
      open={open}
      onOpenChange={setOpen}
      placement="bottom-start"
      matchReferenceWidth
      renderTrigger={({ ref, props }) => (
        <Button
          {...props}
          ref={ref}
          variant="secondary"
          size="unstyled"
          className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
          onClick={() => setOpen((current) => !current)}
          aria-label="Choose provider"
        >
          <span className="flex items-center gap-2">
            <span className="flex size-5 items-center justify-center rounded border border-border bg-background">
              <ModelProviderLogo provider={value.provider} />
            </span>
            {value.label}
          </span>
          <ChevronDown size={16} className="text-muted-foreground" aria-hidden />
        </Button>
      )}
    >
      <div className="overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-xl shadow-black/20">
        <div className="space-y-1 p-2">
          {providers.map((option) => {
            const selected = option.provider === value.provider;
            return (
              <Button
                key={option.provider}
                variant="modelOption"
                size="unstyled"
                className="px-2"
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
              >
                <span className="flex size-6 items-center justify-center rounded-md border border-border bg-background">
                  <ModelProviderLogo provider={option.provider} />
                </span>
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {selected && <Check size={16} className="text-brand" aria-hidden />}
              </Button>
            );
          })}
        </div>
      </div>
    </Popover>
  );
}
