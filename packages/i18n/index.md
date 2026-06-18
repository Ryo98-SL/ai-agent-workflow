# I18n Package Index

## Purpose

`packages/i18n` owns shared locale contracts, Product Locale resolution,
provider setup, resource bundle helpers, key-parity checks, and non-React
translator helpers.

## Current Directory Structure

- `src/locales.ts` defines supported locales, fallback behavior, browser/storage
  helpers, and the Product Locale storage key.
- `src/localeContract.ts` defines the DOM-free locale id contract for pure
  packages.
- `src/resources.ts` converts namespace bundles into i18next resources and
  verifies `en-US` / `zh-CN` key parity.
- `src/provider.tsx` exports the React provider, hooks, and date formatting.
- `src/translator.ts` exports an explicit-locale translator for non-React code.
- `tests/i18n.test.ts` covers locale resolution, translation, and parity checks.

## Runtime Behavior

Product Locale resolves from a manual localStorage value first, then browser
language, then `en-US`. Calling `setLocale` writes the manual value to
localStorage. Resource bundles are namespace-based TypeScript objects owned by
the consuming app or package.

## Integration Notes

React packages should use `I18nProvider`, `useProductLocale`, and
`useTranslation`. Pure packages should accept a `SupportedLocale` or translator
instead of importing browser or React state.
