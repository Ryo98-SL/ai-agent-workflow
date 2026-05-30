# 01 Project Foundation and Schema

## Goal

Create the Electron Forge + React + TypeScript foundation and define the durable workflow schema that all later UI, runtime, and persistence work will use.

## Preconditions

- Read `docs/superpowers/specs/2026-05-30-ai-agent-workflow-mvp-design.md`.
- Start from the current empty repository plus planning docs.

## Scope

- Scaffold Electron Forge with React, TypeScript, Vite or the Forge-recommended bundler, Tailwind CSS, and shadcn/ui compatibility.
- Add baseline scripts for development, build, lint, typecheck, and test.
- Define workflow schema types for `WorkflowFile`, `WorkflowNode`, `WorkflowEdge`, `OpenAICompatibleSettings`, and the initial node union.
- Add schema validation for `.agentflow.json` loading.
- Add prompt variable parsing and resolution utilities.
- Add unit tests for schema validation and prompt variable resolution.
- Add basic project documentation for local development commands.

## Non-Goals

- Do not build the full workbench layout.
- Do not integrate ReactFlow.
- Do not implement model API calls.
- Do not implement Electron file open/save IPC beyond any scaffold defaults.

## Outputs

- Scaffolded Electron + React + TypeScript project.
- Tailwind and shadcn/ui-ready styling setup.
- Workflow schema module and validation tests.
- Prompt variable utility module and tests.
- Development command documentation.

## Handoff Document

Update `01-project-foundation-and-schema-handoff.md` when complete.

## Acceptance Document

Reviewer follows `01-project-foundation-and-schema-acceptance.md`.

