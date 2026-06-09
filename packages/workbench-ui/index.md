# Workbench UI Package Index

## Purpose

Browser-compatible workflow editor and run UI. React Flow is the workspace;
workflow IO stays behind the injected API.

## Structure

- `src/index.ts` exports the public workbench component and types.
- `src/styles.css` provides Tailwind plus the shadcn CSS-variable theme tokens
  (zinc base, light + dark) and token-based base document styles.
- `src/components/ui/` holds the shadcn/ui primitives (new-york style); see its
  `index.md`. `components.json` configures the shadcn CLI for this package.
- `src/lib/utils.ts` exposes the `cn` class-merge helper. The `@workbench/*`
  alias maps to `src/*` (wired in tsconfig, vitest, and the consuming Vite apps).
- `src/data/` contains the workbench data provider, auth/session hooks,
  anonymous local workflow storage, and React Query hooks for account/workflow/
  Knowledge Base resources.
- `src/workbench/` contains state, layout, canvas, panels, Knowledge Base UI,
  and UI primitives.
- `tests/` contains component smoke coverage against a mocked workflow API.

## Behavior

On mount, the workbench loads or creates the server workflow before showing the
canvas. It saves workflows and creates workflow runs through the injected API.
Node creation, model settings, and run output use body-level popovers; node
inspection follows selection. DeepSeek is the default provider, OpenAI and
Anthropic are available in the selector, Ollama is development-only, and API
keys are selected from the workflow provider keyring. Workflow defaults and LLM
node overrides share the same model settings panel for provider, endpoint,
model, temperature, and max-token edits. Knowledge Base management lives in the
settings popover and Knowledge nodes select reusable KBs from the node
inspector. Canvas structure edits have local undo/redo for node/edge creation,
deletion, and movement; form-based inspector changes and model settings stay
outside that history.
