# 04 Acceptance Hardening

## Goal

Verify the complete Start-to-LLM workflow path across shared contracts, server runtime, workbench UI, and app entrypoints, then close documentation handoffs and acceptance records.

## Preconditions

- Read `01-domain-contracts-and-variables-handoff.md`.
- Read `02-server-langgraph-runtime-handoff.md`.
- Read `03-workbench-start-llm-run-flow-handoff.md`.

## Scope

- Run package-level and root validation suites.
- Add or adjust integration tests only where gaps remain between packages.
- Verify the web app can run against the server using the workflow-level run path.
- Update README or package docs if commands or behavior changed.
- Review task handoff documents for complete public interface and known-limit notes.
- Mark acceptance documents accepted only after commands and manual checks pass.

## Non-Goals

- Do not add new product surface beyond acceptance fixes.
- Do not broaden runtime support to unsupported node types.
- Do not introduce production persistence, auth, queues, or streaming.

## Outputs

- Passing validation suite.
- Any final integration or smoke test updates needed to cover the end-to-end path.
- Updated documentation for local run behavior if needed.
- Completed acceptance records for all tasks in this chain.

## Handoff Document

Update `04-acceptance-hardening-handoff.md` when complete.

## Acceptance Document

Reviewer follows `04-acceptance-hardening-acceptance.md`.
