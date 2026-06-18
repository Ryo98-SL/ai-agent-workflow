import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import i18next, { type i18n, type TOptions } from "i18next";
import { I18nextProvider, initReactI18next, useTranslation as useReactI18nextTranslation } from "react-i18next";
import {
  DEFAULT_LOCALE,
  getBrowserLanguages,
  getBrowserStorage,
  readStoredProductLocale,
  resolveInitialLocale,
  SUPPORTED_LOCALES,
  writeStoredProductLocale,
  type SupportedLocale,
} from "./locales";
import { createResourceStore, type I18nResourceBundle } from "./resources";

type ProductLocaleContextValue = {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
};

const ProductLocaleContext = createContext<ProductLocaleContextValue | null>(null);

export type I18nProviderProps = {
  children: ReactNode;
  resources?: readonly I18nResourceBundle[];
  defaultNamespace?: string;
};

export function createI18nInstance({
  locale = DEFAULT_LOCALE,
  resources = [],
  defaultNamespace,
}: {
  locale?: SupportedLocale;
  resources?: readonly I18nResourceBundle[];
  defaultNamespace?: string;
} = {}): i18n {
  const instance = i18next.createInstance();
  void instance.use(initReactI18next).init({
    lng: locale,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: [...SUPPORTED_LOCALES],
    defaultNS: defaultNamespace,
    ns: resources.map((resource) => resource.namespace),
    resources: createResourceStore(resources),
    interpolation: {
      escapeValue: false,
    },
    initImmediate: false,
  });
  return instance;
}

export function I18nProvider({ children, resources = [], defaultNamespace }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<SupportedLocale>(() =>
    resolveInitialLocale({
      storedLocale: readStoredProductLocale(getBrowserStorage()),
      navigatorLanguages: getBrowserLanguages(),
    }),
  );
  const instance = useMemo(
    () => createI18nInstance({ locale, resources, defaultNamespace }),
    [defaultNamespace, locale, resources],
  );

  useEffect(() => {
    void instance.changeLanguage(locale);
  }, [instance, locale]);

  const setLocale = useCallback((nextLocale: SupportedLocale) => {
    writeStoredProductLocale(getBrowserStorage(), nextLocale);
    setLocaleState(nextLocale);
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return (
    <ProductLocaleContext.Provider value={value}>
      <I18nextProvider i18n={instance}>{children}</I18nextProvider>
    </ProductLocaleContext.Provider>
  );
}

export function useProductLocale(): ProductLocaleContextValue {
  const value = useContext(ProductLocaleContext);
  if (!value) {
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => undefined,
    };
  }

  return value;
}

export function useTranslation(namespace?: string) {
  return useReactI18nextTranslation(namespace);
}

export function formatDateForLocale(
  locale: SupportedLocale,
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(locale, options).format(new Date(value));
}

export type TranslationOptions = TOptions;
