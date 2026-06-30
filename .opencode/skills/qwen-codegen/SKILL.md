---
name: qwen-codegen
description: Four-model pipeline — gemma3:4b for vision, deepseek-coder:6.7b for frontend, qwen2.5-coder:7b for backend, big-pickle for planning/review. Triggers on: /feature start, generate code, write code, create component.
---

# Multi-Model Code Generation Workflow

Four-model pipeline: **[gemma3:4b sees?]** → **big-pickle plans** → **deepseek-coder:6.7b codes frontend** + **qwen2.5-coder:7b codes backend** → **big-pickle reviews & applies**.

> **Vision is optional.** If a screenshot exists → gemma enriches the prompt with design data. If not → frontend still generates, using only existing codebase context. Both frontend and backend models **always run**.

## Models

| Role | Model | Purpose |
|------|-------|---------|
| Vision | `gemma3:4b` (3.3 GB) | Analyzes screenshots in `@context/screenshots/` — extracts colors, layout, components |
| Planner & Reviewer | big-pickle (opencode) | Requirements analysis, spec writing, file reading, code review, tsc/lint |
| Frontend Coder | `deepseek-coder:6.7b` (3.8 GB) | Generates React/Tailwind/shadcn components and pages |
| Backend Coder | `qwen2.5-coder:7b` (4.7 GB) | Generates Express routes, Prisma queries, API handlers |

### Why This Split

| Layer | Model | Why |
|-------|-------|-----|
| Frontend (React/TSX/Tailwind) | `deepseek-coder:6.7b` | Trained on more web/UI code, cleaner JSX output, better Tailwind class generation |
| Backend (Express/Prisma) | `qwen2.5-coder:7b` | Strong at TypeScript logic, API routing, database schema patterns |

## Workflow Steps

### Phase 0: Vision (gemma3:4b) — OPTIONAL
**Only runs if a screenshot is provided.** Not a blocker — codegen always runs regardless.

1. User provides screenshot or references one in `@context/screenshots/`
2. Run qwen-vision skill `analyze` action to extract colors, layout, components
3. Save analysis as `context/screenshots/<filename>-analysis.md`
4. Incorporate findings into both frontend and backend prompts as design reference

> **No screenshot?** Skip this phase. Frontend model generates code based on existing codebase conventions and the spec alone. The vision phase enriches the prompt — it never blocks it.

### Phase 1: Plan (big-pickle)
1. Read `@context/ai-interaction.md` and `@context/current-feature.md`
2. Read all relevant existing files to understand conventions
3. Analyze requirements
4. If vision data exists, incorporate it; otherwise rely on existing project patterns
5. Split work into frontend and backend tasks
6. Write two separate detailed prompts — one for deepseek (frontend), one for qwen (backend)

### Source of Design Truth

| Scenario | Frontend prompt gets | Backend prompt gets |
|----------|---------------------|---------------------|
| **Screenshot provided** | Vision colors + layout + existing code patterns | Existing code patterns + spec |
| **No screenshot** | Existing code patterns + spec + project conventions | Existing code patterns + spec |

### Phase 2: Generate Frontend (deepseek-coder:6.7b) — ALWAYS RUNS
```bash
ollama run deepseek-coder:6.7b "<frontend prompt>" > /tmp/deepseek_output.txt
```

Frontend prompt includes:
- Exact file paths in `desktop/ui/`
- React component patterns (function declarations, named/default exports, cn())
- Tailwind classes using brand tokens (from vision analysis if available, else project defaults)
- lucide-react icons
- State management via zustand or local useState
- Loading/error/empty states
- **MANDATORY: Always use shadcn/ui primitives** (Card, Button, Input, Form, Select, etc.) from `@/components/ui/` instead of raw `<div>` elements for UI containers, forms, buttons, cards, etc.
- Similar existing components as reference

### Phase 3: Generate Backend (qwen2.5-coder:7b) — ALWAYS RUNS
```bash
ollama run qwen2.5-coder:7b "<backend prompt>" > /tmp/qwen_output.txt
```

Backend prompt includes:
- Exact file paths in `backend/`
- Express route patterns (export default router, async handlers)
- Prisma queries
- Error handling
- Request/response types

### Phase 4: Review & Apply (big-pickle)
1. Parse both model outputs for code blocks
2. Write/modify files using the Edit tool
3. Run `npx tsc --noEmit` and `npm run lint`
4. Fix any errors
5. Report what each model generated and verification results

## Actions

| Action | Description |
|--------|-------------|
| **generate** | Vision analysis → plan → run deepseek (frontend) + qwen (backend) → apply → verify |

## Keywords That Trigger This Skill

- "/feature start" / "start feature"
- "generate code" / "write code"
- "create component" / "implement"
- "frontend generate" / "backend generate"
- "deepseek code" / "qwen code"
