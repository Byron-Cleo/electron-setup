---
name: feature
description: Manage current feature workflow - load, start, review, test, explain, complete
argument-hint: load|start|review|test|explain|complete
---

# Feature Workflow Command

Manages the full lifecycle of a feature from spec to merge.

## Working File

Uses: `@context/current-feature.md`

## Available Actions

| Action | Description |
|--------|-------------|
| `load` | Load a feature spec or inline description |
| `start` | Begin implementation, create branch |
| `review` | Check goals met, code quality |
| `test` | Write and run unit tests |
| `explain` | Document what changed and why |
| `complete` | Commit, push, merge, reset |

Execute the requested action via `$ARGUMENTS`.
