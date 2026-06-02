# Workbench Inspectors Index

## Purpose

`inspectors` contains node-specific configuration forms used by the workbench
side panel.

## Structure

- `StartInspector.tsx` edits Start labels and text input field declarations.
- `LLMInspector.tsx` edits labels, prompts, model overrides, sampling settings,
  and displays prompt variable reference status for LLM nodes.
- `ToolInspector.tsx` edits Current Time tool labels and timezone settings.
- `UnsupportedInspector.tsx` edits labels for schema-visible nodes whose real
  execution remains deferred.

## Behavior

Inspectors only mutate workflow draft state through callbacks. Server
persistence and workflow-level run creation stay in `AppWorkbench`.
