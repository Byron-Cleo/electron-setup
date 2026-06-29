---
name: feature
description: Use when managing feature/fix workflow — loading specs, starting implementation, reviewing progress, writing tests, explaining changes, or completing a feature. Triggers on keywords: feature, current feature, workflow, load feature, start feature, review feature, test feature, explain feature, complete feature, implement, branch, commit, merge.
---

# Feature Workflow

Manages the full lifecycle of a feature from spec to merge.

## Working File

Uses: `@context/current-feature.md`

### File Structure

The `current-feature.md` file MUST contain ONLY these sections:

| Section | Purpose |
|---------|---------|
| `## Status` | Not Started / In Progress / Complete |
| `## Goals` | Bullet points of what success looks like |
| `## Notes` | Constraints, decisions, implementation details |
| `## History` | Completed features newest first |

History format (newest at top):
```
### YYYY-MM-DD — Feature Title
- Description of what was implemented
```

## Actions

Detailed instructions for each action live in `actions/<action>.md`.

| Action | Description |
|--------|-------------|
| **load** | Load a feature spec or inline description into @context/current-feature.md |
| **start** | Begin implementation, create branch `feature/[name]` |
| **review** | Check goals met, code quality |
| **test** | Write and run unit tests |
| **explain** | Document what changed and why |
| **complete** | Commit, merge to main, delete branch, update status + history |

## Workflow Steps

1. **Read** — Read @context/ai-interaction.md and @context/current-feature.md first
2. **Start** — When user says "start" or "implement", follow detailed instructions in `actions/start.md`
3. **Implement** — Implement the documented feature per the spec
4. **Test** — When user says "test" or "verify", follow detailed instructions in `actions/test.md`
5. **Iterate** — Review code quality; when user says "review", follow detailed instructions in `actions/review.md`
6. **Explain** — When user says "explain" or "what changed", follow detailed instructions in `actions/explain.md`
7. **Complete** — When user says "complete this" or similar, follow detailed instructions in `actions/complete.md`

## Keywords That Trigger This Skill

- "load" / "load the spec"
- "start" / "start implementation" / "let's start"
- "implement" / "begin coding"
- "test" / "verify"
- "explain" / "what changed"
- "complete" / "finish" / "done" / "merge" / "commit"
- "review" / "check"
