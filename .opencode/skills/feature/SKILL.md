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
| `## Platform` | `frontend` or `backend` — determines which model to use for generation |
| `## Status` | Not Started / In Progress / Complete |
| `## Goals` | Bullet points of what success looks like |
| `## Notes` | Constraints, decisions, implementation details |
| `## History` | Completed features newest first |

History format (newest at top):
```
### <platform> - YYYY-MM-DD — Feature Title
- Description of what was implemented
```
`<platform>` must match the `## Platform` value from the feature being completed (e.g., `frontend` or `backend`).

## Actions

Detailed instructions for each action live in `actions/<action>.md`.

| Action | Description |
|--------|-------------|
| **load** | Save a chat description to `context/features/frontend/<name>.md` or `context/features/backend/<name>.md` based on whether the feature involves UI/screens (frontend) or API/DB logic (backend), or load one into `@context/current-feature.md` |
| **start** | Begin implementation, create branch `feature/[name]` |
| **review** | Check goals met, code quality |
| **test** | Write and run unit tests |
| **explain** | Document what changed and why |
| **complete** | Commit, merge to main, delete branch, update status + history |

## Workflow Steps

1. **Read** — Read @context/ai-interaction.md and @context/current-feature.md first
2. **Load** — When user describes a feature in chat, save it as `context/features/<name>.md`. When user says "load feature <name>" or "/feature load <name>", follow detailed instructions in `actions/load.md` to populate `@context/current-feature.md`
3. **Start** — When user says "start" or "implement", follow detailed instructions in `actions/start.md`
4. **Implement** — Check `## Platform` in `current-feature.md` and use the correct model:
   - **If Platform is `frontend`** → load `gemma-frontend` skill and use `gemma3:4b` for ALL React/TSX/Tailwind/shadcn components in `desktop/ui/`
   - **If Platform is `backend`** → load `qwen-codegen` skill and use `qwen2.5-coder:7b` for Express/Prisma logic in `backend/`
   - **Vision** (optional): `qwen2.5vl:3b` only if screenshot provided
   - **Cleanup**: After each model finishes generating output, immediately run `ollama stop <model>` to kill the process — do NOT leave it running in the background
   - **Review**: big-pickle reviews, applies, and runs `tsc --noEmit` + `npm run lint`
5. **Test** — When user says "test" or "verify", follow detailed instructions in `actions/test.md`
6. **Iterate** — Review code quality; when user says "review", follow detailed instructions in `actions/review.md`
7. **Explain** — When user says "explain" or "what changed", follow detailed instructions in `actions/explain.md`
8. **Complete** — When user says "complete this" or similar, follow detailed instructions in `actions/complete.md`

## Keywords That Trigger This Skill

- "load feature" / "load the spec" / "/feature load"
- "start" / "start implementation" / "let's start"
- "implement" / "begin coding"
- "test" / "verify"
- "explain" / "what changed"
- "complete" / "finish" / "done" / "merge" / "commit"
- "review" / "check"
