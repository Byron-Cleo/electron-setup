---
name: feature
description: Use when managing feature/fix workflow — loading specs, starting implementation, reviewing progress, writing tests, explaining changes, or completing a feature. Triggers on keywords: feature, current feature, workflow, load feature, start feature, review feature, test feature, explain feature, complete feature.
---

# Feature Workflow

Manages the full lifecycle of a feature from spec to merge.

## Working File

Uses: `@context/current-feature.md`

### File Structure

The `current-feature.md` file contains:
- `# Current Feature` — H1 heading with feature name when active
- `## Status` — Not Started | In Progress | Complete
- `## Goals` — Bullet points of what success looks like
- `## Notes` — Additional context, constraints, or details from spec
- `## History` — Completed features (append only)

## Workflow

1. **Document** — Document the feature in `@context/current-feature.md`
2. **Branch** — Create new branch for feature/fix
3. **Implement** — Implement according to the spec
4. **Test** — Verify in browser and Electron desktop
5. **Iterate** — Change things if needed
6. **Commit** — Only after build passes (ask first)
7. **Merge** — Merge to main
8. **Delete Branch** — Ask to confirm before deleting after merge
9. **Review** — Review AI-generated code periodically
10. Mark as completed in `@context/current-feature.md` and add to history

## Available Actions

| Action | Description |
|--------|-------------|
| `load` | Load a feature spec or inline description |
| `start` | Begin implementation, create branch |
| `review` | Check goals met, code quality |
| `test` | Write and run unit tests |
| `explain` | Document what changed and why |
| `complete` | Commit, push, merge, reset |
