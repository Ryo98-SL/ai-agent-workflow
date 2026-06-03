# Workbench UI Package Index

## Purpose

Browser-compatible workflow editor and run UI. React Flow is the workspace;
workflow IO stays behind the injected API.

## Structure

- `src/index.ts` exports the public workbench component and types.
- `src/styles.css` provides Tailwind and base document styles.
- `src/workbench/` contains state, layout, canvas, panels, and UI primitives.
- `tests/` contains component smoke coverage against a mocked workflow API.

## Behavior

On mount, the workbench loads or creates the server workflow before showing the
canvas. It saves workflows and creates workflow runs through the injected API.
Node creation, model settings, and run output use body-level popovers; node
inspection follows selection. DeepSeek is the default provider, OpenAI and
Anthropic are available in the selector, Ollama is development-only, and API
keys are saved in the workflow provider keyring unless an LLM node carries its
own Model Setting API key override.
