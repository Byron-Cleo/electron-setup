# Web Interface over WiFi

## Goals

- The backend (Express, port 3001) serves the built React app (`dist-react`) as static files, so the same UI that ships in the Electron app is reachable in any browser over the LAN
- Any device on the WiFi network can open `http://<server-ip>:3001`, log in (PIN), view the menu, and update stock when running low
- SPA fallback: browser routes like `/admin`, `/store`, `/waiter` serve `index.html` on refresh/deep-link (no 404)
- `build:web -- --server <ip>` script produces a web bundle whose API base + image origin point at the server IP (so browsers on other devices hit `http://<server-ip>:3001`, not their own localhost)
- API + uploads routes remain untouched: `/api/*` and `/uploads/*` are never swallowed by the SPA fallback

## Notes

- Backend is ESM Express 4 (`backend/app.ts`, `backend/index.ts`), already binds `0.0.0.0:3001`, open CORS
- `dist-react` lives at the repo root; resolve its path robustly across run contexts (dev via `npm run dev --prefix backend` → cwd is `backend/`, compiled `node dist/index.js` → cwd is root)
- `lib/api.ts` already uses `import.meta.env.VITE_API_BASE/VITE_API_ORIGIN` — no change needed there
- **Critical fix**: `desktop/ui/stores/auth.ts` hardcodes `API_BASE = "http://localhost:3001/api"` — browser login from another device would call its own localhost. Change to `import.meta.env.VITE_API_BASE ?? "http://localhost:3001/api"`
- Electron-only features (receipt/kitchen printing, USB/LAN printer discovery, saved server-config) don't work in a browser — guarded by `window.electron?.` + localStorage fallbacks already
- Verification: `build:web` → start backend → curl `/` (index.html), `/admin` (index.html via SPA fallback), `/api/health`, an asset path
- Branch: `feature/backend/web-interface-wifi` — **DO NOT delete this branch** (kept intentionally)
