# Workbench Inspectors Index

## Purpose

Node-specific configuration forms for the selection inspector.

## Structure

- `StartInspector.tsx` edits Start text input field declarations.
- `LLMInspector.tsx` edits message-based prompts with variable chips, optional
  conversation memory, prompt variable reference status, output variables, and a
  compact Model Setting field (the shared `NodeModelSettingField`).
- `sharedModelSettingField.tsx` is the reusable per-node model selector
  (`NodeModelSettingField`) + `modelSettingsForEditor`/`sanitizeNodeModelSettings`,
  shared by the LLM and Agent inspectors. The field opens a popover with the shared
  `ModelSettingsPanel`; hidden development providers display through the public
  fallback when `showDevModelProviders` is false. Node overrides store provider,
  model, endpoint URL, temperature, and max tokens.
- `AgentInspector.tsx` edits an Agent node: Agentic Strategy picker (functionCalling
  / react, with a "not implemented" note on react), the shared model field, an inline
  tool list (multi-select Tool Browser, per built-in tool an optional author-fixed
  `ToolParamForm`, MCP tools shown model-filled), variable-aware Instruction + Query
  editors (Query required), a Maximum Iterations slider (1–50), a memory toggle, and
  the output variables panel.
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
rich-text editor but persist plain template strings. User-visible inspector
copy, including labels, placeholders, empty states, warnings, action buttons,
and per-node model-setting chrome, is sourced from the package `workbench`
Product Locale namespace.
