import { useState } from "react";
import { SUPPORTED_LOCALES, useProductLocale, useTranslation, type SupportedLocale } from "@ai-agent-workflow/i18n";
import { Popover } from "@ai-agent-workflow/workbench-ui";
import { Check, ChevronDown, Languages } from "lucide-react";

const LANGUAGE_LABEL_KEYS: Record<SupportedLocale, string> = {
  "en-US": "homepage.language.english",
  "zh-CN": "homepage.language.chinese",
};

export function LanguageSwitcher() {
  const { locale, setLocale } = useProductLocale();
  const { t } = useTranslation("web");
  const [open, setOpen] = useState(false);
  const currentLabel = t(LANGUAGE_LABEL_KEYS[locale]);

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      placement="bottom-end"
      renderTrigger={({ ref, props }) => (
        <button
          {...props}
          ref={ref}
          type="button"
          className="flex h-9 shrink-0 items-center gap-2 rounded-md border border-border bg-card px-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
          onClick={() => setOpen((current) => !current)}
          aria-label={t("homepage.language.label")}
          title={t("homepage.language.label")}
        >
          <Languages size={16} className="text-muted-foreground" aria-hidden />
          <span>{currentLabel}</span>
          <ChevronDown size={14} className="text-muted-foreground" aria-hidden />
        </button>
      )}
    >
      <div className="min-w-[9rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
        {SUPPORTED_LOCALES.map((option) => (
          <button
            key={option}
            type="button"
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            onClick={() => {
              setLocale(option);
              setOpen(false);
            }}
          >
            <span className="flex-1">{t(LANGUAGE_LABEL_KEYS[option])}</span>
            {option === locale && <Check size={15} className="text-brand" aria-hidden />}
          </button>
        ))}
      </div>
    </Popover>
  );
}
