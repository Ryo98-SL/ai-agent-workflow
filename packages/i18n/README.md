# I18n

Shared Product Locale and translation helpers for the web workspace.

## Commands

```bash
pnpm --filter @ai-agent-workflow/i18n typecheck
pnpm --filter @ai-agent-workflow/i18n test
pnpm --filter @ai-agent-workflow/i18n build
```

## Usage

Wrap React UI with `I18nProvider`, pass namespace resource bundles from the
owning app or package, and read the current Product Locale with
`useProductLocale`.

Pure code paths can use `createTranslator` with an explicit locale and resource
bundle. This keeps Template Locale decisions outside React state.

Pure packages that only need locale ids can import the DOM-free contract from
`@ai-agent-workflow/i18n/locale-contract`.
