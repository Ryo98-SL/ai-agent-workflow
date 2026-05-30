# 04 File Persistence and Tool Adapter Acceptance

## Validation Commands

- `npm run typecheck`
- `npm run test`
- `npm run lint`

## Manual Checks

- Create a workflow, add/edit an LLM node, save it as `.agentflow.json`, reopen it, and confirm config is restored.
- Open an invalid JSON file and confirm the app shows a clear normalized error.
- Confirm renderer code uses preload-safe IPC rather than direct filesystem access.
- Run a Current Time Tool node and confirm the debug panel shows a successful tool result.
- Confirm API key handling is documented and does not accidentally force secrets into workflow files.
- Confirm HTTP request and JavaScript function tools were not pulled in unless all required MVP work was already complete.

## Acceptance Result

Status: Not reviewed.

Record reviewer, date, command results, and manual review conclusion.

