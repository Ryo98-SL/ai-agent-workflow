# Domain Module Index

## Purpose

`src/domain` owns legacy UI-independent runtime behavior retained for regression
coverage. Shared workflow schema and prompt variable behavior live in
`packages/workflow-domain`.

## Structure

- `runtime/` defines executable adapter contracts and concrete MVP adapters.
- Runtime code imports persisted workflow types from
  `@ai-agent-workflow/workflow-domain`.

## Runtime Boundary

The migrated workbench does not call these adapters. They remain as reference
coverage until real server-side execution replaces the mock run lifecycle.
