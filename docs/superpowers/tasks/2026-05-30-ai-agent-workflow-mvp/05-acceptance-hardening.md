# 05 Acceptance Hardening

## Goal

Close the MVP by verifying the complete user loop, polishing obvious UX issues, and documenting remaining limits.

## Preconditions

- Read all previous task handoff documents.
- Task 01 through Task 04 implementations are complete.
- LLM node debugging, workflow save/reopen, and Current Time Tool execution are available.

## Scope

- Add an end-to-end smoke test for the core loop using a mock OpenAI-compatible server.
- Verify the app starts cleanly in development mode.
- Verify the user can create or open a workflow, add/select an LLM node, configure model settings, edit prompts and variables, run the node, inspect debug output, save, and reopen.
- Verify at least one Tool node adapter can run.
- Fix high-impact UI fit, overlap, empty-state, and error-display problems discovered during acceptance.
- Ensure all planned docs point to the current commands and file paths.
- Update final release notes or MVP status documentation with shipped capabilities and deferred work.

## Non-Goals

- Do not add major new product features.
- Do not broaden the node catalog beyond the spec.
- Do not implement full LangGraph graph execution.
- Do not add cloud features or collaboration.

## Outputs

- End-to-end smoke test or documented smoke-test script.
- Final MVP status notes.
- Any focused fixes needed to satisfy acceptance.
- Updated task handoffs and acceptance results.

## Handoff Document

Update `05-acceptance-hardening-handoff.md` when complete.

## Acceptance Document

Reviewer follows `05-acceptance-hardening-acceptance.md`.

