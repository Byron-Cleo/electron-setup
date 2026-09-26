# test — Write and run unit tests

Creates and runs unit tests for the feature. This repo uses **vitest** (root: `npm run test:backend` / `npm run test:frontend`; backend-only: `npm run test --prefix backend`).

## If the feature changed backend/Prisma code, also verify production

The backend must be rebuilt and deployed before it is considered tested/shipped:

1. `npm run build --prefix backend`
2. `npm run server:restart` (needs an elevated shell)
3. `curl http://localhost:3001/health` → `200 {"status":"ok"}`

See AGENTS.md → Production Deployment (service runs compiled `dist/`, not tsx).