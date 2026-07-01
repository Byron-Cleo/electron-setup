# start — Begin implementation

1. Read `@context/current-feature.md` — confirm `## Platform` and `## Goals`
2. Ensure status is "In Progress" (set if not already)
3. Optionally create feature branch: `git checkout -b feature/<kebab-case-name>`
4. **Auto-select model based on `## Platform`:**
   - If `## Platform` is `frontend` → run `ollama run deepseek-coder:latest` to generate all UI components (React/TSX/Tailwind/shadcn)
   - If `## Platform` is `backend` → run `ollama run qwen2.5-coder:7b` to generate all backend logic (Express/Prisma)
5. Begin coding against the spec requirements using the selected model pipeline
