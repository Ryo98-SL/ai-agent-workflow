# I18n Deep README

## Architecture

`packages/i18n` owns the shared i18next foundation for Product Locale and
Template Locale usage.

- `src/localeContract.ts` defines the DOM-free supported locale ids (`en-US`,
  `zh-CN`) and default locale for pure packages.
- `src/locales.ts` defines fallback behavior, the manual Product Locale
  localStorage key, and local-first browser locale resolution.
- `src/resources.ts` defines namespace resource bundles and parity helpers that
  compare `en-US` and `zh-CN` key paths.
- `src/provider.tsx` creates an i18next instance for React, exposes
  `I18nProvider`, `useProductLocale`, `useTranslation`, and locale-aware date
  formatting.
- `src/translator.ts` creates non-React translators for pure code paths such as
  localized workflow template factories.

## Integration Boundary

Apps and UI packages own their own translation resources and pass them into the
provider. Domain packages do not read browser state or React context; they
receive locale input or a translator explicitly.

## Test Strategy

Package tests cover locale normalization, local-first locale resolution,
non-React translation, storage-key stability, and key-parity failures for missing
locale keys.
