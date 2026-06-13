# shadcn/ui Primitives Index

## Purpose

shadcn/ui primitives owned as source (new-york style, zinc base color). These
are checked into the package so workbench surfaces can share consistent
Tailwind/token styling without reaching into app code.

Components are themed through CSS-variable tokens declared in `src/styles.css`
and consumed with Tailwind utilities.

## Key Files

- `button.tsx` — `Button` + `buttonVariants` (variant: default/destructive/
  outline/secondary/ghost/link; size: default/sm/lg/icon). Supports `asChild`
  via Radix `Slot`.
- `button-group.tsx` — `ButtonGroup` composition primitive for adjacent action
  buttons and separators.
- `card.tsx` — `Card` and `CardHeader`/`CardTitle`/`CardDescription`/
  `CardContent`/`CardFooter` content containers.
- `input.tsx` — `Input` themed text field.
- `label.tsx` — `Label` built on `@radix-ui/react-label`.
- `select.tsx` — `Select` built on `@radix-ui/react-select`.
- `separator.tsx` — `Separator` built on `@radix-ui/react-separator`.
- `badge.tsx` — `Badge` + `badgeVariants` status indicator.
- `textarea.tsx` — `Textarea` themed multiline field.
- `sonner.tsx` — `Toaster` wrapper for product-level toasts.
- `dialog.tsx` — `Dialog` modal built on `@radix-ui/react-dialog` (`DialogContent`/
  `DialogHeader`/`DialogTitle`/`DialogDescription`/`DialogFooter`/`DialogClose`).
  Used for focused flows like adding a labeled API key. The shared dialog keeps
  product-token styling, opens without transition animation, and renders its
  close affordance through the workbench `Button`.

## Conventions

- Import the `cn` helper from `@workbench/lib/utils`; the `@workbench/*` alias
  maps to `src/*` and is wired in tsconfig, vitest, and the consuming Vite apps.
- Add new primitives with `pnpm dlx shadcn@latest add <name>` from this package
  (config in `components.json`); the CLI writes here and rewrites imports to the
  `@workbench/*` alias. Hand-place canonical source only when the registry is
  unreachable.
- Style only through theme tokens (`bg-primary`, `bg-card`, `text-foreground`,
  `border-border`, and similar). Do not reintroduce ad-hoc hex/slate/emerald
  values.
