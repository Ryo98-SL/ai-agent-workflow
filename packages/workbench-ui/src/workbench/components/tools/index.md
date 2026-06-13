# Tool Components Index

## Purpose

`packages/workbench-ui/src/workbench/components/tools` owns descriptor-driven
Tool node selection and configuration UI. Tool runtime execution lives on the
server; this folder only edits workflow draft config.

## Structure

- `ToolBrowser.tsx` lists registered tool descriptors, supports search, and
  exposes reserved tabs for future plugin/custom/workflow/MCP tools.
- `ToolParamForm.tsx` renders one control per descriptor param spec, including
  variable-aware rich text for string/text params that support variables.

## Behavior

The node palette opens `ToolBrowser` before creating a Tool node, and
`ToolInspector` reuses it to rebind an existing node. `ToolParamForm` persists
generic JSON params under the Tool node config; no built-in tool gets a custom
hand-written inspector. Unknown future providers can reuse the same UI once
their descriptors exist.
