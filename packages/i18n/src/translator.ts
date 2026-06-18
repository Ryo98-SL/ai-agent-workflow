import i18next, { type TFunction, type TOptions } from "i18next";
import { DEFAULT_LOCALE, type SupportedLocale } from "./locales";
import { createResourceStore, type I18nResourceBundle } from "./resources";

export type Translator = {
  locale: SupportedLocale;
  t: TFunction;
};

export function createTranslator({
  locale = DEFAULT_LOCALE,
  resources,
  namespace,
}: {
  locale?: SupportedLocale;
  resources: readonly I18nResourceBundle[];
  namespace?: string;
}): Translator {
  const instance = i18next.createInstance();
  void instance.init({
    lng: locale,
    fallbackLng: DEFAULT_LOCALE,
    defaultNS: namespace,
    ns: resources.map((resource) => resource.namespace),
    resources: createResourceStore(resources),
    interpolation: {
      escapeValue: false,
    },
    initImmediate: false,
  });

  return {
    locale,
    t: instance.t.bind(instance),
  };
}

export type { TOptions as TranslatorOptions };
