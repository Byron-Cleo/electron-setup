---
plan: login-screen-media
platform: backend + frontend (backend schema/routes first, then Login + admin UI)
status: Not Started → Ready to Execute
---

## Goal
Make the login screen's left panel controllable from an admin-only Settings section. The admin can switch the panel between an image slideshow and video playback, curate exactly which images transition (checkboxes over every image in the upload folders), and upload/manage videos with two playback options: loop a single clip, or play a playlist in order. Images stay the default at all times; video plays ONLY after the admin explicitly sets it in Settings.

## Current behavior (verified in code)
- `desktop/ui/pages/Login.tsx` → `ImageCarousel()` (line 15) calls `getMenuImages()` (`desktop/ui/lib/api.ts:465`) → `GET /menu/images`, which scans `backend/uploads/menu-items` + `menu-accompaniments` and returns EVERY png/jpg/webp found (`backend/routes/menu.ts:669`). Any menu/accompaniment upload automatically appears — no curation, no switch.
- Rotation: random image every 2s with fade; list re-polled every 30s.
- Uploads: multer, 5 MB cap, jpeg/png/webp only (`menu.ts:198`); served via `express.static` at `/uploads` (`backend/app.ts:58`).
- No settings/config table in Prisma, no video handling and no `<video>` element anywhere in the codebase.

## Confirmed decisions (from user)
1. **Images:** dedicated admin screen lists ALL folder images with a checkbox each — only checked ones transition on the login pane.
2. **Video:** playlist that advances clip-to-clip, PLUS a single-video loop option (playback-mode selector). Muted autoplay.
3. **Control location:** admin-only Settings card (same gating as Server Connection), i.e. `Manager.tsx` + `adminOnly: true`.
4. **Images are the default** when no video is set; video takes over only after explicit admin opt-in. Uploading a video alone changes nothing on screen.
5. **Fallback chain (agreed):** VIDEO mode with no playable clip → images; single-loop clip missing/unplayable → remaining playlist → images; IMAGES mode with nothing checked → today's empty state ("Upload menu images to display here").
6. **Effective mode:** the public endpoint computes the mode server-side (VIDEO requested but zero playable → answers IMAGES), so config/file disagreements can never blank the panel.

## Changes (ready to execute)

### 1. Prisma schema (`backend/prisma/schema.prisma`)
- `LoginMedia`: `id (uuid)`, `kind (IMAGE | VIDEO)`, `filePath (unique, e.g. /uploads/menu-items/x.png or /uploads/login-media/y.mp4)`, `isActive (default true)`, `sortOrder (default 0)`, `createdAt`.
- `LoginMediaConfig` singleton (`id Int @default(1)`): `mode (IMAGES | VIDEO, default IMAGES)`, `videoPlayback (SINGLE_LOOP | PLAYLIST, default SINGLE_LOOP)`, `singleVideoId (nullable, onDelete behavior: cleared manually on video delete)`, `slideIntervalSec (default 2)`.
- `npm run db:sync` after (dev + production per deploy flow).

### 2. Backend — new `backend/routes/loginMedia.ts` (+ `app.ts` mount)
- `GET /login-media` (PUBLIC, pre-auth like `/menu/images` today): returns `{ mode: <effective>, slideIntervalSec, videoPlayback, singleVideo, images: [active urls], videos: [active, ordered] }`. Effective-mode rule applied here.
- `GET /login-media/library` (admin): every scanned folder image with its `isActive` flag + all video rows. Reuses the `/images` scan logic (both subfolders).
- `PUT /login-media/config` (admin): mode / videoPlayback / singleVideoId / slideIntervalSec (clamp 1–30s). Validation backstops: switching to VIDEO requires ≥1 active video (400 otherwise); SINGLE_LOOP requires `singleVideoId` referencing an active video.
- `PUT /login-media/images/selection` (admin): bulk `{ activePaths: string[] }` — the checkbox save; unknown paths ignored, rows upserted by filePath.
- `POST /login-media/videos` (admin): multer diskStorage → `uploads/login-media/`, mime `video/mp4` + `video/webm` only, **200 MB per-file cap** (build value; H.264 mp4 for Electron/Chromium compatibility), uuid filename; creates active row, appended sortOrder.
- `PUT /login-media/videos/order` (admin): `{ ids: [...] }` renumbers sortOrder (up/down buttons, no drag lib).
- `PATCH /login-media/videos/:id` (admin): enable/disable (`isActive`); `DELETE /login-media/videos/:id` (admin): row + best-effort file unlink; if the deleted video was `singleVideoId`, clear the config reference (effective-mode + fallback chain then land the panel on playlist-or-images).
- `app.ts`: mount router + `mkdir uploads/login-media` alongside the existing three folders.
- **First-run backfill (lazy):** if zero IMAGE rows exist, insert one active row per currently scanned folder image → deploy day looks identical to today; config row auto-created as IMAGES.

### 3. Electron IPC + `lib/api.ts` (per the window.electron-first convention)
- `ipc-handlers.ts` proxies the new REST endpoints via fetch (same shape as `menu.listImages`); `preload.cts` exposes `loginMedia.*`; `electron.d.ts` types added.
- `lib/api.ts` gains `getLoginMediaDisplay()`, `getLoginMediaLibrary()`, `saveLoginMediaConfig()`, `saveLoginMediaSelection()`, `uploadLoginMediaVideo()` (FormData direct fetch, as `uploadMenuImage` does today — no IPC serialization for large files), reorder/toggle/delete video helpers.

### 4. `desktop/ui/pages/Login.tsx` — config-driven panel
- `ImageCarousel` fetches `getLoginMediaDisplay()` instead of `getMenuImages()` (30 s poll kept → admin changes reach terminals with no restart).
- VIDEO + ≥1 video → `<video autoPlay muted loop={single} playsInline preload="auto">`; playlist advances on `onEnded`; `onError` falls back to images locally. IMAGES → existing fade carousel over returned actives, interval from `slideIntervalSec` (default 2s = today).
- Loader, preload logic, empty state, and the hide-on-phone behavior stay untouched.

### 5. Admin UI — Settings card + `components/admin/LoginMediaManager.tsx`
- `Manager.tsx`: new card "Login Screen Display" (MonitorPlay icon), `adminOnly: true`, view `"login-media"`, rendered with the standard `onBack` pattern.
- Manager view contents: mode segmented control (Images / Video — **Video disabled until ≥1 active video exists**, helper text explains why); slide-interval input; Images section = library grid with checkboxes (immediate persist per toggle, optimistic UI + toast); Videos section = upload button (`accept="video/mp4,video/webm"`), rows with `<video>` preview, enable/disable, up/down, delete; playback radio (loop-single + clip select / play-all-in-order) shown in video mode; warning banner if mode is VIDEO but nothing is playable (covers mid-air deletions; backend effective-mode already guards the screen).

## Files to modify / create
- Backend: `backend/prisma/schema.prisma`, `backend/routes/loginMedia.ts` (new), `backend/app.ts`, `desktop/electron/ipc-handlers.ts`, `desktop/electron/preload.cts`.
- Frontend: `desktop/ui/lib/api.ts`, `desktop/ui/types/electron.d.ts`, `desktop/ui/pages/Login.tsx`, `desktop/ui/pages/admin/Manager.tsx`, `desktop/ui/components/admin/LoginMediaManager.tsx` (new).

## Verification plan
1. Backend `tsc` + frontend `tsc -b` clean; `npm run lint` zero new.
2. Live on dev backend (:3111 scope or local :3001): default IMAGES renders today's carousel; uncheck-all → empty state; upload mp4 → Video toggle enables; switch → `<video muted autoplay>` renders; delete video mid-VIDEO-mode → panel falls back to images; single-loop `loop` attr present; playlist advances on `ended` (driven via evaluate); interval change respected.
3. Playwright: login screen assertions per mode + admin checkbox/upload round-trip; test rows cleaned up afterwards.

## Workflow & deployment
1. Branch `feature/admin/login-screen-media` off `restaurant-build`.
2. Backend pass first (schema → `db:sync` dev → routes → IPC), verify endpoints live.
3. Frontend pass (Login refactor → admin card/view), `tsc` + lint.
4. Merge `--no-ff` into `restaurant-build`, push.
5. SSH deploy (backend changed): `git pull origin restaurant-build` → `npm run db:sync` (new tables) → `npm run build --prefix backend` → `schtasks /run /tn pos-backend-restart` → verify `sc query EraevaBackend` + `curl http://localhost:3001/health` → `npm run build` + `npm run build:web -- --server same-origin` (build:web rule after any plain build).

---
Status: Ready to Execute
Branch: `feature/admin/login-screen-media`
Plan reference: `context/fix-plan/login-screen-media.md`
