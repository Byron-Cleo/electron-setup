# Generate Backend Action

Triggered by: "write backend", "generate API", "create route", "backend code"

## Prerequisites

1. Read `@context/current-feature.md` for Status, Goals, Notes
2. Read `@context/ai-interaction.md` for conventions
3. Read relevant existing files to understand patterns (routes, db, schema)

## Prompt Template

1. Read the base prompt from `@context/prompts/backend/default.md`
2. Fill in the placeholders:
   - `{file_path}` → the target file path in `backend/`
   - `{requirements}` → specific requirements from the current feature spec
   - `{reference_patterns}` → paths to existing similar routes/handlers as reference
3. Send the completed prompt to qwen2.5-coder:7b via Ollama API

## Apply Output

1. Parse response for code blocks (```typescript, ```prisma)
2. Write/modify files using Edit tool
3. Run `npx tsc --noEmit`
4. Run `npm run lint`
5. Fix any errors — return to qwen if needed

## Fallback Rule

If the model output is bad (incomplete, incorrect, or unusable):
1. **Do NOT silently rewrite the code yourself**
2. Report the specific issues to the user
3. Ask for the user's decision on how to proceed (re-prompt the model, manual implementation, or adjust the spec)
