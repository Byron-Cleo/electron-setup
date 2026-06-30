# load — Load a feature spec

Loads a spec file from `context/features/` into `context/current-feature.md`.

## Two-Phase Flow

### Phase 1 — Save spec from chat
When user describes a feature in chat, save it as a new file. Determine the type:

- **Frontend feature** (UI components, screens, pages, styling) → save to `context/features/frontend/<kebab-case-name>.md`
- **Backend feature** (API routes, DB schema, Prisma, auth logic) → save to `context/features/backend/<kebab-case-name>.md`

Include the feature title, goals, and any implementation notes from the description.
Confirm to the user what file was created.

### Phase 2 — Load spec into current-feature.md
When user says `feature load <name>`:

1. Search both `context/features/frontend/` and `context/features/backend/` for `<name>.md`
2. Read the matching file
3. Determine `## Platform` based on which folder the file was found in:
   - `frontend/` folder → `## Platform` = `frontend`
   - `backend/` folder → `## Platform` = `backend`
4. Populate `context/current-feature.md`:
   - Update `# Current Feature` heading with the feature title
   - Set `## Platform` based on folder (see step 3)
   - Set `## Status` to **In Progress**
   - Fill `## Goals` from the spec
   - Fill `## Notes` with any implementation details, constraints, key decisions
   - Leave `## History` intact
5. Confirm to user that spec is loaded and ready to start. The correct model will be auto-selected based on Platform when implementation begins.
