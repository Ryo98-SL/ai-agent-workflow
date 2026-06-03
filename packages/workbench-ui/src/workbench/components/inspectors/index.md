# Workbench Inspectors Index

## Purpose

Node-specific configuration forms for the selection inspector.

## Structure

- `StartInspector.tsx` edits Start labels and text input field declarations.
- `LLMInspector.tsx` edits labels, prompts, prompt variable reference status,
  and a compact Model Setting field. The field opens a popover with the shared
  model settings editor, node-level API key override, and Advanced controls for
  temperature and max tokens.
- `ToolInspector.tsx` edits Current Time tool labels and timezone settings.
- `UnsupportedInspector.tsx` keeps schema-visible placeholder nodes editable.

## Behavior

Inspectors only mutate workflow draft state through callbacks. Server
persistence and workflow-level run creation stay in `AppWorkbench`.
