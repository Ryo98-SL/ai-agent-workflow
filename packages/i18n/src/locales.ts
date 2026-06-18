export { DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from "./localeContract";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from "./localeContract";

export const PRODUCT_LOCALE_STORAGE_KEY = "ai-agent-workflow.productLocale";

const LANGUAGE_TO_LOCALE: Record<string, SupportedLocale> = {
  en: "en-US",
  "en-us": "en-US",
  zh: "zh-CN",
  "zh-cn": "zh-CN",
  "zh-hans": "zh-CN",
  "zh-hans-cn": "zh-CN",
};

export function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
  return SUPPORTED_LOCALES.includes(value as SupportedLocale);
}

export function normalizeLocale(value: string | null | undefined): SupportedLocale | null {
  if (!value) {
    return null;
  }

  if (isSupportedLocale(value)) {
    return value;
  }

  const normalized = value.trim().replace("_", "-").toLowerCase();
  return LANGUAGE_TO_LOCALE[normalized] ?? LANGUAGE_TO_LOCALE[normalized.split("-")[0] ?? ""] ?? null;
}

export type LocaleResolutionInput = {
  storedLocale?: string | null;
  navigatorLanguages?: readonly string[];
};

export function resolveInitialLocale({ storedLocale, navigatorLanguages = [] }: LocaleResolutionInput): SupportedLocale {
  const manualLocale = normalizeLocale(storedLocale);
  if (manualLocale) {
    return manualLocale;
  }

  for (const language of navigatorLanguages) {
    const browserLocale = normalizeLocale(language);
    if (browserLocale) {
      return browserLocale;
    }
  }

  return DEFAULT_LOCALE;
}

export function readStoredProductLocale(storage: Storage | undefined): SupportedLocale | null {
  try {
    return normalizeLocale(storage?.getItem(PRODUCT_LOCALE_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeStoredProductLocale(storage: Storage | undefined, locale: SupportedLocale): void {
  try {
    storage?.setItem(PRODUCT_LOCALE_STORAGE_KEY, locale);
  } catch {
    // Storage can be disabled in private browsing or test environments.
  }
}

export function getBrowserLanguages(): string[] {
  if (typeof navigator === "undefined") {
    return [];
  }

  if (Array.isArray(navigator.languages) && navigator.languages.length > 0) {
    return [...navigator.languages];
  }

  return navigator.language ? [navigator.language] : [];
}

export function getBrowserStorage(): Storage | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.localStorage;
}
