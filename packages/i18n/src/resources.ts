import type { ResourceLanguage } from "i18next";
import { SUPPORTED_LOCALES, type SupportedLocale } from "./locales";

export type I18nNamespaceResource = Record<string, unknown>;

export type I18nResourceBundle<Namespace extends string = string> = {
  namespace: Namespace;
  resources: Record<SupportedLocale, I18nNamespaceResource>;
};

export type I18nResourceStore = Record<SupportedLocale, Record<string, ResourceLanguage>>;

export function createResourceStore(bundles: readonly I18nResourceBundle[]): I18nResourceStore {
  const store = Object.fromEntries(SUPPORTED_LOCALES.map((locale) => [locale, {}])) as I18nResourceStore;

  for (const bundle of bundles) {
    for (const locale of SUPPORTED_LOCALES) {
      store[locale][bundle.namespace] = bundle.resources[locale] as ResourceLanguage;
    }
  }

  return store;
}

export function getResourceKeyPaths(resource: I18nNamespaceResource, prefix = ""): string[] {
  const paths: string[] = [];

  for (const [key, value] of Object.entries(resource)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isPlainRecord(value)) {
      paths.push(...getResourceKeyPaths(value, path));
    } else {
      paths.push(path);
    }
  }

  return paths.sort();
}

export function getMissingResourceKeys(source: I18nNamespaceResource, target: I18nNamespaceResource): string[] {
  const sourceKeys = new Set(getResourceKeyPaths(source));
  const targetKeys = new Set(getResourceKeyPaths(target));
  return [...sourceKeys].filter((key) => !targetKeys.has(key)).sort();
}

export function assertResourceKeyParity(bundles: readonly I18nResourceBundle[]): void {
  for (const bundle of bundles) {
    const [baseLocale, ...otherLocales] = SUPPORTED_LOCALES;
    const baseResource = bundle.resources[baseLocale];

    for (const locale of otherLocales) {
      const resource = bundle.resources[locale];
      const missingFromLocale = getMissingResourceKeys(baseResource, resource);
      const missingFromBase = getMissingResourceKeys(resource, baseResource);

      if (missingFromLocale.length > 0 || missingFromBase.length > 0) {
        const details = [
          missingFromLocale.length > 0 ? `${locale} missing: ${missingFromLocale.join(", ")}` : null,
          missingFromBase.length > 0 ? `${baseLocale} missing: ${missingFromBase.join(", ")}` : null,
        ]
          .filter(Boolean)
          .join("; ");
        throw new Error(`Translation key parity failed for namespace "${bundle.namespace}": ${details}`);
      }
    }
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
