# Generate Action

Triggered by: `/feature start`, "generate code", "implement"

## Flow

### Step 0: Vision (qwen2.5vl:3b) — if screenshot provided
If user referenced a screenshot or one exists in `@context/screenshots/` for the feature:
1. Follow `qwen-vision/actions/analyze.md` to send the image to qwen2.5vl:3b
2. Save analysis to `context/screenshots/<filename>-analysis.md`
3. Incorporate extracted colors, layout, and components into prompts

### Step 1: Plan (big-pickle)
1. Read `@context/current-feature.md` for Status, Goals, Notes
2. Read `@context/ai-interaction.md` for conventions
3. Read all relevant existing files to understand conventions
4. If vision data exists, reference colors/layout from analysis
5. Split work into:
   - **Frontend files** → `desktop/ui/` (components, pages, stores)
   - **Backend files** → `backend/` (routes, db, schema)
6. Write two separate prompts

### Step 2: Generate Frontend (deepseek-coder:6.7b)
```bash
ollama run deepseek-coder:6.7b "<frontend prompt>" > /tmp/deepseek_output.txt
```

If output is truncated, retry per-file.

### Step 3: Generate Backend (qwen2.5-coder:7b)
```bash
ollama run qwen2.5-coder:7b "<backend prompt>" > /tmp/qwen_output.txt
```

### Step 4: Extract & Apply
1. Parse both outputs for code blocks (```tsx, ```typescript, ```css, ```prisma)
2. Write files using Write/Edit tools
3. Run `npm run lint` and `npx tsc --noEmit`
4. Fix any errors
5. Report what was generated and by which model

### Prompt Templates

Prompt templates are stored at `context/prompts/<platform>/default.md`.

For **frontend** generation:
1. Read `@context/prompts/frontend/default.md`
2. Fill placeholders: `{file_path}`, `{requirements}`, `{reference_patterns}`
3. If vision data exists, append design reference section
4. Send to deepseek-coder:6.7b

For **backend** generation:
1. Read `@context/prompts/backend/default.md`
2. Fill placeholders: `{file_path}`, `{requirements}`, `{reference_patterns}`
3. Send to qwen2.5-coder:7b
