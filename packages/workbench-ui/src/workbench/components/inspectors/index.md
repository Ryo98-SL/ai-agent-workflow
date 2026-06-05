# Workbench Inspectors Index

## Purpose

Node-specific configuration forms for the selection inspector.

## Structure

- `StartInspector.tsx` edits Start text input field declarations.
- `LLMInspector.tsx` edits prompts, prompt variable reference status, and a
  compact Model Setting field. The field opens a popover with the shared model
  settings editor, node-level API key override, and Advanced controls for
  temperature and max tokens.
- `ToolInspector.tsx` edits Current Time adapter and timezone settings.
- `UnsupportedInspector.tsx` explains schema-visible placeholder nodes whose
  execution is deferred.

## Behavior

Inspectors only mutate workflow draft state through callbacks. Server
persistence and workflow-level run creation stay in `AppWorkbench`. Node label
and description editing lives in `NodeInspector.tsx` so the Settings tab only
contains node-type configuration fields.
