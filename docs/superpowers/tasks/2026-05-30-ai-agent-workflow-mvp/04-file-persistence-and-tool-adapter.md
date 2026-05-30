# 04 File Persistence and Tool Adapter

## Goal

Add local workflow file persistence through Electron IPC and implement the first real non-LLM Tool adapter.

## Preconditions

- Read `01-project-foundation-and-schema-handoff.md`.
- Read `02-workbench-and-canvas-handoff.md`.
- Read `03-llm-debug-runtime-handoff.md`.
- Runtime adapter interfaces are stable.
- The workbench can edit workflow state.

## Scope

- Add preload-safe Electron IPC APIs for opening and saving `.agentflow.json` files.
- Add `ProjectFileActions` for new, open, save, save as, dirty state, and visible file path.
- Validate workflow files on open and show normalized file errors.
- Preserve workflow metadata and `updatedAt` on save.
- Decide and document whether `apiKey` is saved in the workflow file or local app settings for this implementation; avoid accidental secret commits by default.
- Implement a real built-in `Current Time` Tool adapter through the same runtime boundary used by the LLM adapter.
- Allow selecting and running the current time Tool node from the workbench.
- Add tests for file serialization, invalid file handling, dirty state, and Tool adapter execution.

## Non-Goals

- Do not implement HTTP request or JavaScript function tool execution unless the LLM and file flows are already fully accepted.
- Do not implement project directories.
- Do not implement cloud sync.
- Do not implement system keychain storage.

## Outputs

- Electron IPC file APIs.
- Project file action UI.
- Workflow open/save validation.
- Dirty state handling.
- Current Time Tool adapter.
- Tests for file and Tool behavior.

## Handoff Document

Update `04-file-persistence-and-tool-adapter-handoff.md` when complete.

## Acceptance Document

Reviewer follows `04-file-persistence-and-tool-adapter-acceptance.md`.

