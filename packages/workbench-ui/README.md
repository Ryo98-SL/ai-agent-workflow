# Workbench UI

Reusable React workbench for editing workflows and running them through an
injected workflow API. React Flow is the primary workspace; node creation, model
settings, inspection, and run output live in floating panels.

Principles:

- Keep workflow persistence and runs behind the injected API.
- Keep popovers mounted under `body` so canvas containers cannot clip them.
- Keep node handle behavior direction-aware: source creates outgoing edges,
  target creates incoming edges.
- Show important canvas state in-place: Start inputs, LLM effective model with
  bundled provider logo, and selected-node feedback.
- Keep model configuration consistent: global settings and LLM node overrides
  share the same provider/model/API key editor, with node advanced settings for
  temperature and max tokens.

```tsx
import { AppWorkbench } from "@ai-agent-workflow/workbench-ui";
import "@xyflow/react/dist/style.css";
import "@ai-agent-workflow/workbench-ui/styles.css";

<AppWorkbench workflowApi={client} />;
```

Consumers provide a workflow API compatible with
`@ai-agent-workflow/workflow-client`. DeepSeek, OpenAI, and Anthropic are
available by default with local logo assets; pass `showDevModelProviders` to
expose development providers such as Ollama. Provider API keys are edited per
provider, and LLM nodes can override provider, model, base URL, API key,
temperature, and max tokens.
