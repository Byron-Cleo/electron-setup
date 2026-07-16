# complete — Commit, merge, sync, reset

## Steps (execute ALL in order)

### 1. Stage & commit
- Run `git status`, `git diff --stat`, `git log --oneline -5`
- Stage only the files changed during feature implementation (not `git add -A`)
- Commit with descriptive message summarizing changes

### 2. Checkout main
- `git checkout main`

### 3. Merge feature branch
- `git merge <feature-branch>` (fast-forward or regular merge)

### 4. Delete feature branch
- `git branch -d <feature-branch>`

### 5. Push main
- `git push origin main` (sync merged changes with remote)

### 6. Reset current-feature.md
- Set Platform to "Not Specified"
- Set status back to "Not Started"
- Clear Goals and Notes sections (leave blank)
- Append history entry for completed feature in format: `### <platform> - YYYY-MM-DD — Feature Title` (platform from `## Platform` field)

## CRITICAL — Do NOT skip any step
Every step must be executed. Do not stop after commit.
