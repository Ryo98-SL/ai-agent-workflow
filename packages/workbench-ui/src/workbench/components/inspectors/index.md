# Workbench Inspectors Index

## Purpose

Node-specific configuration forms for the selection inspector.

## Structure

- `StartInspector.tsx` edits Start text input field declarations.
- `LLMInspector.tsx` edits message-based prompts with variable chips, optional
  conversation memory, prompt variable reference status, output variables, and a
  compact Model Setting field. The field opens a popover with the shared
  `ModelSettingsPanel`; provider API keys are selected from model groups, while
  node overrides store provider, model, endpoint URL, temperature, and max
  tokens.
- `ToolInspector.tsx` lets users rebind a Tool node through the Tool Browser and
  renders descriptor-defined params through `ToolParamForm`.
- `IfElseInspector.tsx` edits case branches, condition combinators, operators,
  and variable references.
- `HumanInputInspector.tsx` edits reviewer prompts, action buttons, optional
  text input, and output variables.
- `EndInspector.tsx` edits the final answer template.
- `UnsupportedInspector.tsx` explains schema-visible placeholder nodes whose
  execution is deferred.

## Behavior

Inspectors only mutate workflow draft state through callbacks. Server
persistence and workflow-level run creation stay in `AppWorkbench`. Node label
and description editing lives in `NodeInspector.tsx` so the Settings tab only
contains node-type configuration fields. Variable-bearing fields use the shared
rich-text editor but persist plain template strings.
