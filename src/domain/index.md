# Domain Module Index

## Purpose

`src/domain` owns UI-independent workflow and runtime behavior.

## Structure

- `workflow/` defines `.agentflow.json` types, validation, serialization, default workflow creation, node factories, and prompt variable utilities.
- `runtime/` defines executable adapter contracts and concrete MVP adapters.

## Runtime Boundary

React components call `executeNode` with a selected persisted node, model settings, and test variables. Adapter implementations return normalized debug results for the UI to display.
