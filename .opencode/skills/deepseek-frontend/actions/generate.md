# Generate Frontend Action

Triggered by: "write frontend", "create component", "build UI", "style page"

## Prerequisites

1. Read `@context/current-feature.md` for Status, Goals, Notes
2. Read `@context/ai-interaction.md` for conventions
3. Read relevant existing files to understand patterns
4. If screenshot analysis exists in `@context/screenshots/*-analysis.md`, incorporate colors/layout

## Prompt Template

Send this prompt verbatim to deepseek-coder:6.7b via Ollama API:

```
You are deepseek-coder:6.7b generating frontend code for Eraeva POS Billing System.
Return ONLY valid code — no explanations, no markdown.

Tech Stack:
- React 19, TypeScript 6, Tailwind CSS v4, lucide-react icons
- shadcn/ui primitives (Card, CardHeader, CardTitle, CardContent, CardDescription, Button, Input, Form, Label, Select)
- react-router-dom (NavLink, Outlet, useNavigate)
- zustand for state
- cn() from @/lib/utils for conditional class merging

MANDATORY RULES:
1. Import ALL UI from @/components/ui/ — NO raw <div> containers for structural elements
2. Use brand token colors from @theme inline in index.css — NO hardcoded hex colors
3. Function declarations (function X()) for components
4. Default exports for page-level components
5. Named exports for utilities
6. .ts extension in relative imports (./foo.ts)
7. No semicolons
8. Path alias @/ resolves to desktop/ui/
9. Loading, error, and empty states for any data-fetching components
10. data-slot attributes for shadcn styling hooks

Design Reference:
[Colors, layout, component details from spec or vision analysis]

File: [path]

Requirements:
1. [specific requirement]
2. [specific requirement]

Existing patterns to follow:
- [reference file path and key pattern]
```

## Apply Output

1. Parse response for code blocks
2. Write/modify files using Edit tool
3. Run `npx tsc --noEmit --project tsconfig.app.json`
4. Run `npm run lint`
5. Fix any errors — return to deepseek if needed
