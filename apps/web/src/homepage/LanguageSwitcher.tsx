import { Languages } from "lucide-react";
import { SUPPORTED_LOCALES, useProductLocale, useTranslation, type SupportedLocale } from "@ai-agent-workflow/i18n";

const LANGUAGE_LABEL_KEYS: Record<SupportedLocale, string> = {
  "en-US": "homepage.language.english",
  "zh-CN": "homepage.language.chinese",
};

export function LanguageSwitcher() {
  const { locale, setLocale } = useProductLocale();
  const { t } = useTranslation("web");

  return (
    <label
      className="flex h-9 shrink-0 items-center gap-2 rounded-md border border-border bg-card px-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
      title={t("homepage.language.label")}
    >
      <Languages size={16} className="text-muted-foreground" aria-hidden />
      <span className="sr-only">{t("homepage.language.label")}</span>
      <select
        className="h-full cursor-pointer bg-transparent text-sm font-medium text-foreground outline-none"
        value={locale}
        onChange={(event) => setLocale(event.target.value as SupportedLocale)}
        aria-label={t("homepage.language.label")}
      >
        {SUPPORTED_LOCALES.map((option) => (
          <option key={option} value={option}>
            {t(LANGUAGE_LABEL_KEYS[option])}
          </option>
        ))}
      </select>
    </label>
  );
}
