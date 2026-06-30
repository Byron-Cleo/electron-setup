# start — Begin implementation

1. Read `@context/current-feature.md` — confirm `## Platform` and `## Goals`
2. Ensure status is "In Progress" (set if not already)
3. Optionally create feature branch: `git checkout -b feature/<kebab-case-name>`
4. **Auto-select model based on `## Platform`:**
   - If `## Platform` is `frontend` → load `deepseek-frontend` skill and invoke it to generate all UI components
   - If `## Platform` is `backend` → load `qwen-codegen` skill and invoke it to generate all backend logic
5. Begin coding against the spec requirements using the selected model pipeline
