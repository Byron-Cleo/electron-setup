# Eraeva POS Billing System 

A desktop application for restaurant management system

## AGENTS.md

This file provides guidance to opencode (BigPickle/opencode) when working with code in this repository.

## Context7 MCP — Documentation Lookup

Use Context7 MCP to fetch current documentation whenever the user asks about a library, framework, SDK, API, CLI tool, or cloud service -- even well-known ones like React, Next.js, Prisma, Express, Tailwind, Django, or Spring Boot. This includes API syntax, configuration, version migration, library-specific debugging, setup instructions, and CLI tool usage. Use even when you think you know the answer -- your training data may not reflect recent changes. Prefer this over web search for library docs.

Do not use for: refactoring, writing scripts from scratch, debugging business logic, code review, or general programming concepts.


## Context Files

Read the following to get the full context of the project.

- @context/project-overview.md
- @context/coding-standards.md
- @context/ai-interaction.md
- @context/current-feature.md

## Architecture

**Monorepo** with three sub-projects:

```
root/
├── desktop/ui/          # React 19 frontend (Vite 8, Electron renderer)
├── desktop/electron/    # Electron 42 main process (Node.js)
└── backend/             # Express 4 REST API (prod port 3001, dev port 3111, Prisma 7 → PostgreSQL)
```

### Data Flow

```
React Component → window.electron.* (contextBridge)
  → ipcRenderer.invoke → ipcMain.handle
    → fetch("http://localhost:3111/api/...")  # dev port; prod resolves via server-config
      → Express route → Prisma → PostgreSQL
```

**Port split:** Production uses port **3001**, run by the `EraevaBackend` Windows service (NSSM, StartType Automatic) executing `node backend/dist/index.js` with `NODE_ENV=production`. The backend MUST be rebuilt (`npm run build --prefix backend`) before restarting the service whenever source changes — the service runs compiled `dist/`, not tsx. Control it with the root `server:start|stop|restart|status|logs` npm scripts (status/logs need no elevation; start/stop/restart do) or `sc query EraevaBackend`. Development uses port **3111** so the dev backend can run alongside the production server. Dev defaults are wired through `.env.development` (`VITE_API_BASE`/`VITE_API_ORIGIN`) and `server-config.ts` (`NODE_ENV=development` → `DEV_API_BASE`).

No React Router — view switching via `useState<Tab>` and `useState<view>` in `App.tsx`.

## Tech Stack

| Concern | Choice |
|---|---|
| Language | TypeScript 6 (strict, `verbatimModuleSyntax`, `erasableSyntaxOnly`) |
| Frontend | React 19 + Vite 8 |
| Desktop | Electron 42, context isolation enabled |
| Backend | Express 4, ESM |
| ORM | Prisma 7 with `@prisma/adapter-pg` |
| Database | PostgreSQL |
| UI Library | shadcn/ui (Radix primitives + CVA) + lucide-react icons |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite` plugin) — class-based, no CSS Modules |
| Forms | react-hook-form + zod 4 schemas |
| State | Local `useState`/`useEffect` — no global store |
| Linting | ESLint 10 flat config (TS, react-hooks, react-refresh) |
| Font | Geist Variable (`@fontsource-variable/geist`) |
| Module | ESM (`"type": "module"` in all `package.json`) |

### Key Versions

- TypeScript ~6.0, React ^19.2, Vite ^8.0
- Electron ^42.3, Prisma ^7.8, Express ^4.21
- Tailwind ^4.3, Zod ^4.4, react-hook-form ^7.79
- eslint ^10.3, typescript-eslint ^8.59

## Conventions

### Branch Naming (MANDATORY)

All feature branches MUST follow this format:

```
feature/<layer>/<task-kebab-case>
```

| Layer | Example |
|-------|---------|
| waiter | `feature/waiter/place-order` |
| store | `feature/store/add-ingredients` |
| kitchen | `feature/kitchen/order-queue` |
| sales | `feature/sales/receipt-generation` |
| cashier | `feature/cashier/daily-reconciliation` |
| admin | `feature/admin/dashboard` |

**Rules:**
- Always `feature/` prefix
- Layer must match one from the table above
- Task name in kebab-case (e.g., `col2-detail-panel-redesign`)
- Never use `feature/waiter-landing-ui` — always `feature/waiter/landing-ui`

### General

- **TypeScript strict**: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` enabled
- **ESM only**: `import`/`export`, use `.ts` extension in relative imports (`./foo.ts`)
- **No semicolons** inconsistently used — match file's existing style when editing
- **Named exports** for utilities (`cn`, `Button`, `Card`)
- **Default exports** for page-level components and route handlers
- **Function declarations** (`function X()`) preferred over arrow functions for components
- **Interfaces** defined inline in component files or in `types/electron.d.ts`

### Menu Pricing Rule (MANDATORY)

- `menu.price` is the **unit price** of the main dish **excluding** accompaniments.
- Any menu item served with a **charged** starch and/or vegetable must still count as ONE main dish toward the order's dish count (`oi.quantity` — never a separate line).
- When a **charged** starch/vegetable is selected, its price MUST be included in the dish total: line total = `(unit + chargedStarch + chargedVegetable) × qty` (`WaiterOrderContext.linePrice`, `WaiterMenuGrid.linePrice`, `orders.ts` itemsPrice, and Cashier line totals all apply this).
- Free accompaniments (`price` null/`<= 0`) add nothing to the price.
- The dish-detail panel shows the combined "Total" (unit + charged selections) once a charged accompaniment is chosen.

### Path Aliases

- `@/` → `desktop/ui/` (configured in `vite.config.ts` and `tsconfig.app.json`)
- shadcn aliases: `@/components`, `@/lib/utils`, `@/components/ui`, `@/hooks`

### Components

- **MANDATORY: Use shadcn/ui primitives for ALL UI elements** — no raw `<div>` containers for cards, buttons, forms, or layout shells. Import from `@/components/ui/` (`Card`, `Button`, `Input`, `Select`, `Form`, `Label`, etc.)
- Feature directories under `desktop/ui/components/<feature>/`
- shadcn primitives in `desktop/ui/components/ui/`
- UI primitives use `cn()` from `@/lib/utils` (clsx + tailwind-merge)
- `data-slot` attributes for Tailwind styling hooks (shadcn pattern)
- Error/loading/empty states handled with conditional rendering
- Props interface named `Props` and defined in the component file

### Styling

- Tailwind utility classes in JSX `className`
- `cn()` for conditional class merging
- Design tokens as CSS variables in `index.css` with `@theme inline` block
- Dark mode via `.dark` class variant

### Forms

- Zod schemas defined as `formSchema`, type inferred: `type FormValues = z.infer<typeof formSchema>`
- `useForm` with `zodResolver` from `@hookform/resolvers`
- `form.setError("root", ...)` for API errors
- `form.reset()` in `useEffect` for edit mode

### IPC / API Layer

- Preload (`preload.cts`) uses `contextBridge.exposeInMainWorld("electron", ...)`
- Namespaced: `window.electron.mealType.*`, `window.electron.menu.*`
- IPC handlers in `ipc-handlers.ts` proxy to Express via `fetch()`
- Dev API base: `http://localhost:3111/api` (via `.env.development` + `server-config.ts` dev default); production resolves through the main-process `server-config.json`

### Frontend API Convention (MANDATORY)

- **All API calls go through `@/lib/api.ts`** — components never call `window.electron.*` or `fetch()` directly
- `lib/api.ts` contains:
  - `apiFetch()` — base fetch helper with error handling
  - Per-resource functions (e.g., `getStockSupplies()`, `createStockSupply()`) that check `window.electron` first, then fall back to direct `fetch()`
- This ensures identical behavior in both Electron and browser dev mode
- Component files contain **only rendering logic** — import API functions from `@/lib/api`
- When adding a new resource, add its API functions to `lib/api.ts` following the existing pattern

### Backend

- Express routes use `export default router`
- Prisma client singleton in `backend/db/db.ts`
- Route files in `backend/routes/`
- Prisma schema in `backend/prisma/schema.prisma`

## Commands

### Development (root)

| Command | Description |
|---|---|
| `npm run dev` | Run React + Electron concurrently |
| `npm run dev:react` | Vite dev server only (port 5123) |
| `npm run dev:electron` | Compile Electron TS + launch Electron |
| `npm run dev:backend` | Start Express backend (dev port 3111) |
| `npm run lint` | ESLint check (`.ts`, `.tsx` files) |
| `npm run build` | Type-check all + Vite build |
| `npm run preview` | Preview built React app |

### Development Order

1. `npm run dev:backend` (terminal 1)
2. `npm run dev` (terminal 2)

### Production Builds

| Command | Description |
|---|---|
| `npm run build` | `tsc -b && vite build` → `dist-react/` |
| `npm run transpile:electron` | `tsc` Electron → `dist-electron/` |
| `npm run build:mac` | Build + package DMG/ZIP |
| `npm run build:win` | Build + package NSIS/portable |
| `npm run build:linux` | Build + package AppImage/deb/rpm |

### Backend (prefix: `backend/`)

| Command | Description |
|---|---|
| `npm run dev` | `tsx watch index.ts` (hot reload, dev port 3111) |
| `npm run build` | `tsc` → `dist/` |
| `npm run start` | `node dist/index.js` |

### Production Deployment (MANDATORY)

The production backend is the **`EraevaBackend`** Windows service (NSSM, StartType Automatic) running `node backend/dist/index.js` with `NODE_ENV=production` on port **3001**. It runs **compiled `dist/`, not tsx** — source changes require a **rebuild**, not just a restart.

After ANY change under `backend/` (routes, app, db, scheduler, events, seeds, etc.):
1. `npm run build --prefix backend`
2. `npm run server:restart` (start/stop/restart need an elevated shell; status/logs do not)
3. Verify: `npm run server:status` → `RUNNING` and `curl http://localhost:3001/health` → `{"status":"ok",...}`

If `backend/prisma/schema.prisma` changed, run `npm run db:sync` (generate + push) BEFORE the rebuild + restart so the DB is in sync with `dist/`.

Service shortcuts: `npm run server:start|stop|restart|status|logs` (logs tail `backend/logs/backend-service.log`). pm2, `ecosystem.config.cjs`, and `scripts/start-backend.bat` are retired — do not restore or use them.

## Project Structure

```
.
├── desktop/
│   ├── electron/           # Electron main process
│   │   ├── main.ts         # App entry, BrowserWindow, IPC registration
│   │   ├── preload.cts     # contextBridge API exposure
│   │   ├── ipc-handlers.ts # IPC → REST proxy handlers
│   │   ├── resourceManager.ts  # OS polling (CPU/RAM/storage)
│   │   ├── pathResolver.ts # Preload path resolver
│   │   └── utils.ts        # isDev helper
│   └── ui/                 # React renderer
│       ├── main.tsx        # React entry point
│       ├── App.tsx          # Tab switching + view controller
│       ├── index.css       # Tailwind + shadcn CSS vars
│       ├── lib/utils.ts    # cn() utility
│       ├── types/electron.d.ts  # MealType, MenuItem, ElectronAPI types
│       └── components/
│           ├── ui/         # shadcn primitives (button, card, form, input, etc.)
│           ├── mealType/   # MealType feature components
│           ├── menu/       # Menu feature components
│           ├── MealTypeList.tsx
│           ├── MealTypeForm.tsx
│           ├── MenuList.tsx
│           └── MenuForm.tsx
├── backend/
│   ├── src/
│   │   ├── index.ts       # Server entry (connect DB, listen 3001)
│   │   ├── app.ts         # Express app (cors, json, routes)
│   │   ├── db.ts          # Prisma client singleton
│   │   ├── routes/mealTypes.ts  # CRUD /api/meal-types
│   │   └── routes/menu.ts       # CRUD /api/menu
│   ├── prisma/schema.prisma  # All models: User, Account, Session, Cart,
│   │                          #   Order, OrderItem, Menu, MealType, MenuAccompaniment,
│   │                          #   MenuMealType, Review, VerificationToken
│   └── package.json
├── vite.config.ts
├── tsconfig.json           # Project references to app/node/electron
├── components.json         # shadcn/ui configuration
├── electron-builder.json   # Electron packaging config (mac/win/linux)
└── package.json
```

## Database Schema (Prisma Enums)

`MealPeriod`: `BREAKFAST | LUNCH | DINNER | DESSERT | BEVERAGE`

## Key Environment Variables

| Variable | Location | Default |
|---|---|---|
| `DATABASE_URL` | `backend/.env` | `postgresql://mac@localhost:5432/eraevadb` |
| `PORT` | `backend/.env` | `3001` |
| `NODE_ENV` | Root `.env` | `development` |
