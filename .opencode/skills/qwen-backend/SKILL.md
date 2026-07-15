---
name: qwen-backend
description: Backend code generation using qwen2.5-coder:7b for Express/Prisma/API routes. Triggers on: write backend, generate API, create route, backend code.
---

# Qwen Backend Code Generation

Uses `qwen2.5-coder:7b` (4.7 GB) to generate ALL backend logic. This is the **only** model used for Express/Prisma work.

## Why Qwen for Backend

- Strong at TypeScript logic, API routing, and database schema patterns
- Handles Prisma queries, Express middleware, and error handling well
- Proven quality from earlier project phases

## Requirements Enforced

1. Express routes use `export default router`
2. Async handlers with proper error handling (try/catch, status codes)
3. Prisma client singleton from `backend/db/db.ts`
4. Route files in `backend/routes/`
5. Request/response types defined inline or imported
6. Read `@context/current-feature.md` and `@context/ai-interaction.md` before generating

## Invocation

The model is called via Ollama API (non-streaming) at `http://localhost:11434/api/generate`.

```bash
curl -s http://localhost:11434/api/generate -d '{
  "model": "qwen2.5-coder:7b",
  "prompt": "...",
  "stream": false
}' | python3 -c "import sys,json; print(json.load(sys.stdin)['response'])"
```

## Actions

| Action | Description |
|--------|-------------|
| **generate** | Generate backend component(s) for a given spec — always uses qwen2.5-coder:7b |

## Keywords That Trigger This Skill

- "backend code" / "backend generate"
- "create route" / "write API"
- "express route" / "prisma query"
- "qwen code" / "qwen backend"
