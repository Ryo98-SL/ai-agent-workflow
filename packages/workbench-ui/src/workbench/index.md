# Workbench Module Index

## Purpose

Reusable workbench state, layout, and canvas runtime.

## Structure

- `AppWorkbench.tsx` owns workflow state, API calls, initial load gating, and
  floating panel visibility.
- `types.ts` defines workbench UI state and the injected workflow API contract.
- `components/` contains the layout shell, ReactFlow canvas, popovers, palette,
  inspectors, model settings, project actions, and run panel.
- `assets/` contains bundled DeepSeek, OpenAI, Anthropic, and Ollama provider
  logos used by model UI.

## Behavior

The module waits for a server workflow before mounting the canvas. Selection
opens inspection; explicit run requests open run output. Handle palettes wire
new nodes by handle direction, and target-handle palettes disable End. Model
settings expose DeepSeek, OpenAI, and Anthropic by default, with Ollama behind
the development-provider flag. Provider API keys live in the workflow keyring,
and LLM node Model Setting popovers can override provider, model, API key,
temperature, and max tokens while the canvas displays the resolved effective
model. Non-MVP node types remain visible schema placeholders.
