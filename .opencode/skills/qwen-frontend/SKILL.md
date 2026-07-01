---
name: qwen-frontend
description: Frontend code generation using qwen2.5-coder:7b for React/TSX/Tailwind/shadcn components. Triggers on: write frontend, create component, build UI, style page.
---

# Qwen Frontend Code Generation

Uses `qwen2.5-coder:7b` to generate ALL frontend UI components. This is the **only** model used for React/TSX/Tailwind work.

## Why Qwen for Frontend

- Strong at TypeScript (6.2B params) — excellent code generation quality
- Deep React and Tailwind pattern knowledge
- Consistent output structure across both frontend and backend tasks

## Requirements Enforced

1. **MANDATORY: shadcn/ui primitives only** — no raw `<div>` containers for cards, buttons, forms. Import from `@/components/ui/`
2. Brand tokens from `@theme inline` in `index.css` — no hardcoded hex colors
3. Function declarations for components, default exports for pages
4. `cn()` from `@/lib/utils` for conditional classes
5. lucide-react icons, Tailwind classes only (no CSS modules)
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
| **generate** | Generate frontend component(s) for a given spec — always uses qwen2.5-coder:7b |

## Keywords That Trigger This Skill

- "frontend code" / "frontend generate"
- "create component" / "build UI"
- "write frontend" / "make component"
- "style page" / "shadcn component"
- "qwen code" / "qwen frontend"
