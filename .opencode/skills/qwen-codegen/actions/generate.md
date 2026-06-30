# Generate Action

Triggered by: `/feature start`, "generate code", "implement"

## Flow

### Step 0: Vision (gemma3:4b) — if screenshot provided
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

### Frontend Prompt Template

```
You are deepseek-coder generating frontend code for Eraeva POS Billing System.
Generate ONLY the code. No explanations.

Tech stack: React 19, TypeScript 6, Tailwind CSS v4, lucide-react icons,
shadcn/ui primitives (Button, Card, CardHeader, CardTitle, CardContent, CardDescription, Input, Form, Select, etc.), react-router-dom, zustand

Conventions:
- **MANDATORY: Use shadcn/ui primitives for ALL UI elements** — no raw `<div>` containers, no hand-styled buttons, no manual card patterns. Import from `@/components/ui/` (e.g., `Card`, `Button`, `Input`)
- Named exports for utilities, default exports for page components
- Function declarations for components
- Tailwind classes only (no CSS modules)
- cn() from @/lib/utils for conditional classes
- No semicolons
- .ts extension in relative imports
- Path alias @/ → desktop/ui/

Design reference (from screenshot analysis):
[Vision findings: colors, layout, components]

File: [path]

Requirements:
1. ...
2. ...

Existing patterns to follow:
- [reference similar component]
```

### Backend Prompt Template

```
You are qwen2.5-coder generating backend code for Eraeva POS Billing System.
Generate ONLY the code. No explanations.

Tech stack: Express 4, TypeScript 6, Prisma 7, ESM modules, bcrypt-ts-edge

Conventions:
- Export default router
- Async route handlers with try/catch
- Prisma client from ../db.js or ../../db/db.js
- .ts extension in relative imports
- Error responses: { error: "message" }

File: [path]

Requirements:
1. ...
2. ...
```
