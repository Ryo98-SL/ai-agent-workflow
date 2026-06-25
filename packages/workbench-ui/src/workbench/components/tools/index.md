# Tool Components Index

## Purpose

`packages/workbench-ui/src/workbench/components/tools` owns descriptor-driven
Tool node selection and configuration UI. Tool runtime execution lives on the
server; this folder only edits workflow draft config.

## Structure

- `ToolBrowser.tsx` lists registered tool descriptors (`getToolDescriptors()` —
  built-in + client-injected MCP), supports search, and has Built-in / MCP tabs
  plus reserved Plugin / Custom / Workflow tabs. It works single-select (add /
  rebind via `onSelect`) or multi-select (Agent tool list via `selectedKeys` +
  `onToggle`). The MCP tab surfaces a "管理 MCP 服务器" entry (`onOpenMcpServers`)
  and an empty-state CTA.
- `ToolParamForm.tsx` renders one control per descriptor param spec, including
  variable-aware rich text for string/text params that support variables.
- `EmailSendControl.tsx` owns the explicit real-send confirmation switch.
- `EmailCapabilityStatus.tsx` renders loading, unavailable, signed-out,
  exhausted, and remaining-quota states.
- `agentToolDefaults.ts` pins `send:false` when Send Email is added to an Agent.

## Behavior

The node palette opens `ToolBrowser` before creating a Tool node, and
`ToolInspector` reuses it to rebind an existing node. The Agent inspector reuses
it in multi-select mode to pick several tools into the Agent tool list.
`ToolParamForm` persists generic JSON params under the node config; for an Agent
tool binding it holds the **author-fixed** params (unset params are filled by the
model). No built-in tool gets a hand-written inspector; MCP descriptors render
through the same UI once injected.

Send Email's ordinary message fields still use `ToolParamForm`; only the
destructive `send` switch uses the dedicated safety control so it can require
server availability and explicit confirmation.
