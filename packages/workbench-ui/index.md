# Workbench UI Package Index

## Purpose

Browser-compatible workflow editor and run UI. React Flow is the workspace;
workflow IO stays behind the injected API.

## Structure

- `src/index.ts` exports the public workbench component, public data/account
  hooks, provider-key store hook, auth client type, and workbench API types.
- `src/styles.css` provides Tailwind plus the shadcn CSS-variable theme tokens
  (zinc base, light + dark) and token-based base document styles.
- `src/components/ui/` holds the shadcn/ui primitives (new-york style); see its
  `index.md`. `components.json` configures the shadcn CLI for this package.
- `src/lib/utils.ts` exposes the `cn` class-merge helper. The `@workbench/*`
  alias maps to `src/*` (wired in tsconfig, vitest, and the consuming Vite apps).
- `src/auth/` contains Better Auth UI and the anonymous-local-data import prompt.
- `src/theme/` contains theme provider/menu state.
- `src/data/` contains the workbench data provider, Better Auth client,
  anonymous IndexedDB workflow storage, session-scoped anonymous run tracking,
  and React Query hooks for account/workflow/Knowledge Base resources.
- `src/workbench/` contains state, layout, canvas, panels, Knowledge Base UI,
  Tool Browser, variable-rich text editor, Chat Mode UI, and workflow primitives.
- `tests/` contains component smoke coverage against a mocked workflow API.

## Behavior

On mount, the workbench waits for auth/session resolution, chooses the
server-backed API for signed-in users or the IndexedDB local adapter for
anonymous users, then loads an existing workflow or an unsaved starter draft.
Anonymous runs send the current workflow inline to the server; signed-in runs
use durable workflow ids and run history.

Node creation, model settings, and run output use body-level popovers; node
inspection follows selection. DeepSeek is the default provider, OpenAI and
Anthropic are available in the selector, Ollama is development-only, and API
keys/AI credits are selected from provider groups. Workflow defaults and LLM
node overrides share the same model settings panel. Knowledge Base management
lives in the settings popover and Knowledge nodes select reusable KBs from the
node inspector.

Chat Mode sends user messages as run `query` values against a stable
conversation id. Human Input pauses show resume forms. Tool nodes are selected
through the Tool Browser and configured through descriptor-driven param forms.
Canvas structure edits have local undo/redo for node/edge creation, deletion,
and movement; form-based inspector changes and model settings stay outside that
history.
