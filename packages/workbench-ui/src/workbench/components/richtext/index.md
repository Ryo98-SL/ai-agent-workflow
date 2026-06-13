# Rich Text Variable Editor Index

## Purpose

`packages/workbench-ui/src/workbench/components/richtext` owns the Lexical-based
editor used by prompt-like fields that store canonical
`{{nodeId.path}}` template strings.

## Structure

- `VariableRichTextEditor.tsx` is the controlled editor wrapper used by LLM,
  Knowledge, Tool, Human Input, and Template-style fields.
- `VariableNode.tsx` defines the atomic variable chip node.
- `SlashVariablePlugin.tsx` provides `/` insertion from upstream Available
  Variables.
- `variableSerialization.ts` converts between canonical strings and Lexical
  editor nodes.

## Behavior

The editor presents variable references as chips, but the source of truth
remains the plain template string. It supports single-line or multiline fields,
plain paste, IME-safe controlled updates, and keyboard navigation across atomic
chips. Variable availability is scoped by the consuming node through
`WorkflowGraphContext`.
