# AI Interaction Guidelines

## Communication

- Be concise and direct
- Explain non-obvious decisions briefly
- Ask before large refactors or architectural changes
- Don't add features not in the project spec
- Never delete files without clarification

## Workflow

This is the common workflow that we will use for every single feature/fix.
ALWAYS read this file and @context/current-feature.md before starting any implementation.

### current-feature.md Structure

The file @context/current-feature.md MUST contain ONLY these sections in order:

| Section | Purpose |
|---------|---------|
| `## Platform` | `frontend` or `backend` — determines codegen model; defaults to `Not Specified` |
| `## Status` | Not Started / In Progress / Complete |
| `## Goals` | Bullet points of what success looks like |
| `## Notes` | Constraints, decisions, implementation details |
| `## History` | Completed features with date heading format below |

History entries follow this format and must be ordered **newest first** (most recent feature at the top):
```
### YYYY-MM-DD — Feature Title
- Description of what was implemented
```

### Steps

1. **Read** — Read @context/ai-interaction.md and @context/current-feature.md first
2. **Branch** — Create new branch for feature/fix
3. **Implement** — Implement the feature/fix documented in @context/current-feature.md
4. **Test** — Verify it works in the browser and electron desktop. Implement unit testing later.
5. **Iterate** — Iterate and change things if needed
6. **Commit** — Only after build passes and everything works (ask first)
7. **Merge** — Merge to main
8. **Delete Branch** — Ask to confirm before delete branch after merge
9. **Review** — Review AI-generated code periodically and on demand
10. **Complete** — Update @context/current-feature.md Status to Complete and add History entry

Do NOT commit without permission and until the build passes. If build fails, fix the issues first.

## Branching

We will create a new branch for every feature/fix. Name branch **feature/[feature]** or **fix[fix]**, etc. Ask to delete the branch once merged.

## Commits

- Ask before committing (don't auto-commit)
- Use conventional commit messages (feat:, fix:, chore:, etc.)
- Keep commits focused (one feature/fix per commit)
- Never put "Generated With Claude" in the commit messages

## When Stuck

- If something isn't working after 2-3 attempts, stop and explain the issue
- Don't keep trying random fixes
- Ask for clarification if requirements are unclear

## Code Changes

- Make minimal changes to accomplish the task
- Don't refactor unrelated code unless asked
- Don't add "nice to have" features
- Preserve existing patterns in the codebase

## Code Review

Review AI-generated code periodically, especially for:

- Security (auth checks, input validation)
- Performance (unnecessary re-renders, N+1 queries)
- Logic errors (edge cases)
- Patterns (matches existing codebase?)
