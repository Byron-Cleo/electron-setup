# Eraeva POS Billing System — AGENTS.md

## Architecture

**Monorepo** with three sub-projects:

```
root/
├── desktop/ui/          # React 19 frontend (Vite 8, Electron renderer)
├── desktop/electron/    # Electron 42 main process (Node.js)
└── backend/             # Express 4 REST API (port 3001, Prisma 7 → PostgreSQL)
```

### Data Flow

```
React Component → window.electron.* (contextBridge)
  → ipcRenderer.invoke → ipcMain.handle
    → fetch("http://localhost:3001/api/...")
      → Express route → Prisma → PostgreSQL
```

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

### General

- **TypeScript strict**: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` enabled
- **ESM only**: `import`/`export`, use `.ts` extension in relative imports (`./foo.ts`)
- **No semicolons** inconsistently used — match file's existing style when editing
- **Named exports** for utilities (`cn`, `Button`, `Card`)
- **Default exports** for page-level components and route handlers
- **Function declarations** (`function X()`) preferred over arrow functions for components
- **Interfaces** defined inline in component files or in `types/electron.d.ts`

### Path Aliases

- `@/` → `desktop/ui/` (configured in `vite.config.ts` and `tsconfig.app.json`)
- shadcn aliases: `@/components`, `@/lib/utils`, `@/components/ui`, `@/hooks`

### Components

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
- API base: `http://localhost:3001/api` (hardcoded in `ipc-handlers.ts`)

### Backend

- Express routes use `export default router`
- Prisma client singleton in `backend/src/db.ts`
- Route files in `backend/src/routes/`
- Prisma schema in `backend/prisma/schema.prisma`

## Commands

### Development (root)

| Command | Description |
|---|---|
| `npm run dev` | Run React + Electron concurrently |
| `npm run dev:react` | Vite dev server only (port 5123) |
| `npm run dev:electron` | Compile Electron TS + launch Electron |
| `npm run dev:backend` | Start Express backend (port 3001) |
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
| `npm run dev` | `tsx watch src/index.ts` (hot reload) |
| `npm run build` | `tsc` → `dist/` |
| `npm run start` | `node dist/index.js` |

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
