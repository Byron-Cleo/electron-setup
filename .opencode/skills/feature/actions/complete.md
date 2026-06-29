# complete — Commit, push, merge, reset

## Steps (execute ALL in order)

### 1. Stage & commit
- Run `git status`, `git diff --stat`, `git log --oneline -5`
- `git add -A` then commit with descriptive message summarizing changes

### 2. Push
- Push current branch to remote with `git push`

### 3. Create Pull Request
- Use `gh pr create` with title and body summarizing changes

### 4. Merge
- Merge the PR (squash or regular merge)

### 5. Reset current-feature.md
- Set status back to "Not Started"
- Clear Goals and Notes sections
- Append history entry for completed feature

## CRITICAL — Do NOT skip any step
Every step must be executed. Do not stop after commit.
