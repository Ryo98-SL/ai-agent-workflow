# AI Agent Workflow

Glossary for the visual workflow editor where users wire nodes into a graph and
reference one node's outputs from another. This file defines the shared language
for *node variables* — how upstream outputs are referenced, displayed, and edited.

## Language

### Variables

**Variable Reference**:
A pointer from one node's config to an upstream node's output, stored canonically
as a `{{nodeId.path}}` string embedded in a text field (e.g. `{{llm1.text}}`). The
string is the single source of truth; all richer UI parses and re-serializes it.
_Avoid_: variable binding, expression, placeholder

**Variable Tag**:
The pill UI that renders a single Variable Reference as node identity (icon +
label) plus the variable name with a `{x}` glyph — the unified visual used on
node cards, in inspectors, and inline in rich text. Mirrors Dify's variable chip.
_Avoid_: variable pill, chip, token, badge

**Available Variables**:
The set of Variable References a given node may legally reference — the outputs of
its *connected ancestors* (transitive reverse-edge reachability), grouped by
producing node in topological order. Disconnected nodes never appear. Computed by
`getAvailableVariables(nodes, edges, nodeId)` in `workflow-domain`.
_Avoid_: upstream variables, visible variables, scope

**Variable Picker**:
The searchable popover, opened from a Variable Tag (if/else) or by typing `/` in a
rich-text field, that lists Available Variables grouped by node and inserts/swaps
the chosen Variable Reference. One shared component across both entry points.
_Avoid_: variable menu, autocomplete, dropdown
