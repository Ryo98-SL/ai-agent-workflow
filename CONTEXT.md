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
producing node in topological order, plus any **Ambient Variables** (see below).
Disconnected nodes never appear. Computed by
`getAvailableVariables(nodes, edges, nodeId)` in `workflow-domain`.
_Avoid_: upstream variables, visible variables, scope

**Ambient Variable**:
A Variable Reference that is *not* produced by any node and is available to every
node regardless of graph topology — the exception to the "connected ancestors"
rule above. The only ambient namespace today is `userInput` (a reserved node id),
exposed in **Chat Mode** workflows as `{{userInput.query}}` (the current chat
message) and `{{userInput.files}}` (reserved for deferred multimodal input).
Surfaced as a synthetic Available Variables group prepended ahead of node groups.
Mirrors Dify's `sys.*` system variables. The id `userInput` is reserved and may
not be used by a real node.
_Avoid_: system variable, global variable, sys namespace, context variable

**Variable Picker**:
The searchable popover, opened from a Variable Tag (if/else) or by typing `/` in a
rich-text field, that lists Available Variables grouped by node and inserts/swaps
the chosen Variable Reference. One shared component across both entry points.
_Avoid_: variable menu, autocomplete, dropdown

### Conversation

**Chat Mode**:
A persisted, workflow-level capability (vs. the default one-shot **Workflow Mode**)
that turns a graph into a multi-turn chatbot, mirroring Dify's *Chatflow*. In Chat
Mode the **DebugPanel** renders a chat transcript, the `userInput` **Ambient
Variable** namespace becomes available to every node, **Start** fields are
collected once at conversation start (constant for all turns), and each message
sets `{{userInput.query}}`. Conversation memory and its summary compression are
configured here.
_Avoid_: chatflow, conversation mode, agent mode

### Output

**Answer Template**:
The free-form rich-text template authored on an **End** node (`config.answer`),
holding literal text interleaved with Variable References. When a run reaches that
End node, the template is resolved against runtime state and the resulting text is
that node's final output. A graph may hold several End nodes, each with its own
Answer Template; only the End node actually reached on a given run contributes its
output. Mirrors the role of Dify's *Answer* node (not Dify's *End* node).
_Avoid_: output template, reply, response, final message

### Graph Editing

**Edge Insert**:
The act of adding a new node onto an existing edge `A → B` via the hover "+"
button at the edge's midpoint. The original edge is *always consumed* (deleted).
For a single-input/single-output node it splices: `A → N → B`, with N inheriting
A's source handle. For a multi-output node (e.g. **If/Else**) only the input is
wired (`A → N`); none of N's outputs auto-connect, so B is left dangling for the
user to rewire. Start/End are never offered as the inserted node.
_Avoid_: split edge, edge drop, insert between

### Tools

**Tool Node**:
The single workflow node type (`type: "tool"`) that invokes one configured tool
through the runtime boundary. There is **one** node type for *all* tools — Current
Time, Send Email, and future MCP/custom tools — not a distinct node type per tool.
Which specific tool a given Tool Node runs is recorded in its `config` and chosen
from the **Tool Registry**, so the model stays open to dynamically-discovered
tools (MCP) that can never be static node types. Mirrors Dify's single *Tool* node
(differentiated by provider, not by node type).
_Avoid_: tool type, currentTime node, email node, adapter node

**Tool Registry**:
The catalog of selectable tools that the Tool Browser lists and that each **Tool
Node** binds to. Each entry supplies a tool's identity (id, label, icon,
category) and the pieces the rest of the app dispatches on — its config defaults,
inspector form, runtime behavior, and output variables. Built-in tools are static
entries; MCP/custom tools are additional entries (eventually populated
dynamically). The registry is what makes one node type behave like many distinct,
independently-pickable nodes.
_Avoid_: tool catalog, adapter registry, plugin list

**Tool Browser**:
The Dify-style searchable picker (tabs: All / Plugin / Custom / Workflow / MCP)
that lists **Tool Registry** entries so the user can choose *which* tool to add.
Picking a tool inserts a **Tool Node** already bound to that tool. Distinct from
the general **Node Palette**, which picks a node *type*; the Tool Browser drills
into the one Tool type to pick a specific tool.
_Avoid_: tool picker, tool palette, marketplace
