# Windows Installer — Single Guided Installer + Branded App Icon + Desktop Shortcut + Pre-Login Server IP Recovery

## Goal

Deliver a Windows experience that a non-technical restaurant user can install and use without the developer:

- The build produces **exactly one .exe** — the NSIS installer
- Double-clicking opens a **guided installation window** (choose install folder → progress → Finish), then the app **auto-launches** and a **desktop shortcut** appears
- The shortcut is labeled **"Eraeva POS System"** with the **Eraeva logo** (from `eraeva-logo.png` → `.ico`) — clicking it launches the app any time, no re-running the .exe
- If the baked server IP is ever wrong (server IP changed, wrong network), the app shows a **pre-login "Enter server IP" screen** at launch instead of a dead-end login — the user types the new IP, reconnects, then logs in normally

---

## Current Behavior

- `electron-builder.json` `win.target` = `["nsis", "portable"]` — produces TWO .exe files
- The **portable** exe runs in place: no install, no shortcuts, nothing persisted → staff must re-run the .exe every time
- **No app icon configured** — `resources/` is empty, no `win.icon` → installed app, taskbar, and shortcut all show the default Electron icon
- `productName` = "Eraeva POS Billing System" → shortcut label, installer name, and .exe filename all say "Billing System"
- `index.html` `<title>` = `pos-billing-system` (window title bar)
- `desktop/electron/main.ts` BrowserWindow sets no explicit title
- Server IP is baked at build time (`build:win:network --server http://<ip>:3001`) with **no recovery path** — if the IP changes, users can't reach the server, can't log in, and can't reach Settings → Server Connection (which is admin-gated anyway) → dead end

---

## Phase 1 — Single NSIS Installer + Branded Icon + Rebrand

### 1. Rebrand product name

- `electron-builder.json` → `productName: "Eraeva POS System"`
- `index.html` → `<title>Eraeva POS System</title>`
- `artifactName` already uses `${productName}` → .exe filename updates automatically

### 2. Windows: single NSIS installer (drop portable)

- `electron-builder.json` → `win.target` = only `[{ target: "nsis", arch: ["x64"] }]`
- NSIS is already the guided wizard: `oneClick: false`, `allowToChangeInstallationDirectory: true`, `createDesktopShortcut: true`, `createStartMenuShortcut: true`

### 3. NSIS polish

- `shortcutName: "Eraeva POS System"` → desktop + Start Menu icon label
- `runAfterFinish: true` → app auto-launches when the wizard completes
- `installerIcon`, `uninstallerIcon`, `installerHeaderIcon` → Eraeva logo inside the installer window itself

### 4. App icon (`.png` → `.ico`)

- Source: `public/images/logo/eraeva-logo.png` (1254×1254)
- Convert to `build/icon.ico` (multi-size: 16, 24, 32, 48, 64, 128, 256 px)
- electron-builder auto-detects `build/icon.ico` → embedded in the .exe → taskbar, installer, shortcut all branded
- Add a regeneration script so the icon can be rebuilt if the logo changes

### 5. Verify Phase 1 on Windows

- `npm run build:win:network -- --server http://<ip>:3001`
- `release/` contains **one** .exe (no portable)
- Run installer → wizard shows "Eraeva POS System" + logo → choose folder → Finish → app auto-launches
- Desktop + Start Menu shortcuts created, labeled "Eraeva POS System", with logo
- Close app → launch from the desktop shortcut works

---

## Phase 2 — Pre-Login Server IP Recovery

### The problem

The server IP is baked at build time. If it changes (DHCP reassignment, new router, server machine replaced), every installed terminal points at a dead IP: the user can't log in, and the fix (Settings → Server Connection) is locked behind admin login. Staff get a dead end and must call the developer.

### The fix

- On app launch, before showing the login screen, ping the configured server (`GET /health`, short timeout)
- If reachable → straight to login (business as usual)
- If **not reachable** → show a **"Server not reachable" screen** instead of login:
  - Clear message: "Can't reach the POS server at `http://<ip>:3001`"
  - Input field for the server IP/URL (accepts bare IP, IP:port, or full URL — same normalization as Server Connection)
  - "Reconnect" button → saves the new address to the runtime config (`server-config.json` via existing `server-config:save` IPC) → re-pings → on success shows login
  - Keep a "Try again" path so a temporary outage doesn't get overwritten by a bad entry
- Renderer entry point (`App.tsx` or a wrapper) decides between the recovery screen and login based on a connection check from `lib/api.ts`
- **Reuse existing pieces**: `lib/api.ts` `testServerConnection`, `saveServerConfig`, and the `getApiBase()` runtime resolution in `ipc-handlers.ts` already support runtime IP changes — this screen simply surfaces them before login instead of after

### The flow (what the user experiences)

1. App launches → tries to reach the server before login appears
2. Server unreachable → "Enter server IP" screen instead of login
3. User types the new IP → app reconnects → login screen appears → proceeds normally
4. Server reachable → no screen, straight to login

### Verify Phase 2

- Launch with wrong baked IP → recovery screen shows (no login dead-end)
- Enter correct IP → reconnects → login works
- Enter a bad IP → friendly error, can retry
- Reachable server → recovery screen never shows, straight to login
- Works in browser web mode too (localStorage fallback for server config)

---

## Files Changed

| File | Action | Phase |
|------|--------|-------|
| `electron-builder.json` | Update — productName, win.target (nsis only), nsis options (shortcutName, runAfterFinish, installer icons), win.icon | 1 |
| `index.html` | Update — `<title>` | 1 |
| `build/icon.ico` | **Create** — generated from `eraeva-logo.png` | 1 |
| `scripts/icon.mjs` (new) | **Create** — converts PNG → ICO for regeneration | 1 |
| `desktop/electron/main.ts` | Update — optional explicit window title for dev | 1 |
| `desktop/ui/pages/...` (new recovery screen) | **Create** — pre-login server-not-reachable UI | 2 |
| `desktop/ui/App.tsx` | Update — connection check gate before login | 2 |
| `desktop/ui/lib/api.ts` | Update — pre-login connection test + save helpers | 2 |

---

## Notes

- Build happens on a Windows machine at the restaurant (`npm run build:win:network`), or on this Mac only for the NSIS target via `electron-builder --win` (icon still applies).
- Mac work (icon.icns, DMG branding) is a separate follow-up fix — this spec is Windows-focused; Phase 2 is cross-platform (helps the web interface too).
- `.ico` must be committed to the repo so the Windows build machine can use it without regenerating.
- Phase 1 ships first (installer + icon + rebrand). Phase 2 (server IP recovery) is implemented after Phase 1 is verified.
