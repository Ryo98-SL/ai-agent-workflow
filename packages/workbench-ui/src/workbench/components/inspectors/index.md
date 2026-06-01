# Workbench Inspectors Index

## Purpose

`inspectors` contains node-specific configuration forms used by the workbench
side panel.

## Structure

- `LLMInspector.tsx` edits labels, prompts, model overrides, sampling settings,
  and prompt variable defaults for LLM nodes.
- `ToolInspector.tsx` edits Current Time tool labels and timezone settings.
- `UnsupportedInspector.tsx` edits labels for schema-visible nodes whose real
  execution remains deferred.

## Behavior

Inspectors only mutate workflow draft state through callbacks. Server
persistence and run creation stay in `AppWorkbench`.
