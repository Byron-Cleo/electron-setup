# Generate Frontend Action

Triggered by: "write frontend", "create component", "build UI", "style page"

## Prerequisites

1. Read `@context/current-feature.md` for Status, Goals, Notes
2. Read `@context/ai-interaction.md` for conventions
3. Read relevant existing files to understand patterns
4. If screenshot analysis exists in `@context/screenshots/*-analysis.md`, incorporate colors/layout

## Prompt Template

1. Read the base prompt from `@context/prompts/frontend/default.md`
2. Fill in the placeholders:
   - `{file_path}` → the target file path in `desktop/ui/`
   - `{requirements}` → specific requirements from the current feature spec
   - `{reference_patterns}` → paths to existing similar components as reference
3. If vision analysis exists, append design reference (colors, layout) from the analysis file
4. Send the completed prompt to deepseek-coder:6.7b via Ollama API

## Apply Output

1. Parse response for code blocks
2. Write/modify files using Edit tool
3. Run `npx tsc --noEmit --project tsconfig.app.json`
4. Run `npm run lint`
5. Fix any errors — return to deepseek if needed
