# load — Load a feature spec

Loads a spec file from `context/features/` into `context/current-feature.md`.

## Two-Phase Flow

### Phase 1 — Save spec from chat
When user describes a feature in chat, save it as a new file:
- Create `context/features/<kebab-case-name>.md`
- Include the feature title, goals, and any implementation notes from the description
- Confirm to the user what file was created

### Phase 2 — Load spec into current-feature.md
When user says `feature load <file-name>`:

1. Read `context/features/<file-name>.md`
2. Populate `context/current-feature.md`:
   - Update `# Current Feature` heading with the feature title
   - Set `## Status` to **In Progress**
   - Fill `## Goals` from the spec
   - Fill `## Notes` with any implementation details, constraints, key decisions
   - Leave `## History` intact
3. Confirm to user that spec is loaded and ready to start
