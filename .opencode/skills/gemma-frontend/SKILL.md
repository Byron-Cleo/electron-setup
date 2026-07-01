---
name: gemma-frontend
description: Frontend code generation using gemma3:4b for React/TSX/Tailwind/shadcn components. Triggers on: write frontend, create component, build UI, style page.
---

# Gemma Frontend Code Generation

Uses `gemma3:4b` to generate ALL frontend UI components. This is the **only** model used for React/TSX/Tailwind work.

## Why Gemma for Frontend

- Lightweight (4B params) — fast inference on local hardware
- Strong instruction following for structured code generation
- Good TypeScript and React pattern knowledge

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
  "model": "gemma3:4b",
  "prompt": "...",
  "stream": false
}' | python3 -c "import sys,json; print(json.load(sys.stdin)['response'])"
```

## Actions

| Action | Description |
|--------|-------------|
| **generate** | Generate frontend component(s) for a given spec — always uses gemma3:4b |

## Keywords That Trigger This Skill

- "frontend code" / "frontend generate"
- "create component" / "build UI"
- "write frontend" / "make component"
- "style page" / "shadcn component"
- "gemma code" / "gemma frontend"
