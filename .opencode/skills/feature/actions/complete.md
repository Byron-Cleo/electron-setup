# complete — Commit, merge, sync, deploy, reset

## Steps (execute ALL in order)

### 1. Stage & commit (on the feature branch)
- Run `git status`, `git diff --stat`, `git log --oneline -5`
- Stage only the files changed during feature implementation (not `git add -A`)
- Commit with a descriptive conventional message

### 2. Deploy backend changes (if any)
- If any file under `backend/` (non-doc) changed: `npm run build --prefix backend` → `npm run server:restart` → verify `/health`
- See AGENTS.md → Production Deployment

### 3. Merge into the integration branch
- Default integration branch is `restaurant-build` (NOT `main`). Confirm the parent with `git merge-base` first.
- `git checkout <parent>` then `git merge --no-ff <feature-branch>` (matches repo history style)

### 4. Ask before deleting the feature branch
- Do NOT delete it automatically — the user may want to keep it. `git branch -d <feature-branch>` only if explicitly asked.

### 5. Push the integration branch
- `git push origin <parent>` (sync merged changes with remote)

### 6. Reset current-feature.md
- Set Status to "Complete"
- Set Platform to "Not Specified"
- Clear Goals and Notes sections (leave blank)
- Append history entry: `### <platform> - YYYY-MM-DD — Feature Title`

## CRITICAL — Do NOT skip any step
Every step must be executed. Do not stop after commit.