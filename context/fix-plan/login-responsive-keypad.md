---
plan: login-responsive-keypad
platform: frontend (React/Tailwind — Login page only)
status: Not Started → Ready to Execute
---

## Goal
Make the PIN keypad on the login screen fully visible and usable on ANY screen size — phone browsers in portrait and landscape, tablets, and desktop terminals. All 12 keys (digits 1–9, 0, ✕ delete, → submit) plus the PIN dots must be on-screen and tappable with no clipping and no scrolling wherever possible. Desktop appearance stays pixel-identical.

## Diagnosis (root causes in `desktop/ui/pages/Login.tsx`)

| Problem | Location | Effect on a phone |
|---|---|---|
| Inner sizes use `vh` but root uses `h-dvh` | throughout vs line 151 | `vh` tracks the LARGE viewport (ignores the collapsing URL bar), so every element is sized for a taller screen than is actually visible → bottom of the card (rows 7-8-9, ✕ 0 →) gets clipped by `overflow-hidden` |
| Keypad buttons have fixed heights, cannot shrink | lines 220, 228, 234, 240 (`h-[min(9vh,80px)] aspect-square`) | When the fixed stack (header + title + dots + 4 rows + gaps + footer) exceeds the viewport, the overflow is silently cut off — exactly the "1–9 / submit / delete not visible" symptom |
| `overflow-hidden` on the keypad card | line 182 | Anything that does not fit is clipped instead of scrolled — no recovery |
| Exit button is a no-op in the browser | lines 152–159 | Shows a confirm popup in the phone browser, then does nothing (`window.electron?.app?.quit()` is Electron-only) |

Vertical budget check (360×740-class phone, ~680dvh visible): header ≈ 258px + card fixed content ≈ 115px + 4×61px keys ≈ 244px + grid padding ≈ 27px → ≈ 644px against a ~394px main area **computed against the larger `vh`** → guaranteed clip. Converting to `dvh` + making keys shrink-to-fit brings the total inside the visible area at every size.

## Confirmed decisions (from user)
- **The image carousel side is NOT touched** — user confirmed it works fine on their phone. Two-column layout (`grid-cols-2`) stays exactly as-is on all sizes.
- **Exit button: hidden in the browser, shown in the desktop app.**
- **Delivery: merge to `restaurant-build` + rebuild the web bundle on the server** (browser live view at 192.168.100.45:3001). Frontend-only — **no EraevaBackend rebuild/restart**.
- Desktop visual parity: every change must render identically at typical terminal sizes (≥ 768px tall). Compaction for short screens is gated behind a `max-height:560px` media query; key sizing keeps the existing 80px cap and ~9dvh proportion.

## Changes (ready to execute)

All changes in **one file**: `desktop/ui/pages/Login.tsx`. No logic changes — `handleKeyPress`, `handleClear`, `handleSubmit`, `handleExit`, the carousel component, and the two-column grid are untouched. Pure className/unit work + one conditional render.

### 1. Unit fix — `vh` → `dvh` everywhere in this file
Replace every `vh` occurrence with `dvh` so all sizes track the *actual visible* height on mobile browsers (identical to `vh` on desktop):
- Header section (line 161): `pt-[min(4dvh,40px)] pb-[min(3dvh,24px)]`
- Logo (line 165): `w-[min(18dvh,160px)] h-[min(18dvh,160px)] mb-[min(3dvh,30px)]`
- Title (line 167): `text-[min(6dvh,60px)] my-[min(2dvh,32px)]`
- Main grid (line 173): `gap-[min(4dvh,32px)] px-[min(6dvh,40px)] pb-[min(4dvh,40px)]`
- Card title (line 183): `text-[min(4dvh,36px)]`
- PIN dots (line 195): `w-[min(4dvh,32px)] h-[min(4dvh,32px)]`
- Keypad gap (line 215): `gap-[min(1.6dvh,16px)]`

### 2. Keypad that shrinks to fit (core fix)
Keypad grid (line 215) — becomes a flexible consumer of remaining card space, 4 explicit rows:
```
className="flex-1 min-h-0 grid grid-cols-3 grid-rows-4 gap-[min(1.6dvh,16px)] items-center justify-items-center"
```
(drop `mt-auto` — `flex-1` now absorbs the slack; `justify-items-center` stays, `items-center` added so capped keys center vertically in tall rows)

All four key buttons (lines 217–252) — replace `h-[min(9vh,80px)] aspect-square` with shrink-to-fit sizing:
```
className="min-h-[40px] h-full max-h-[80px] w-full max-w-[80px] ... touch-manipulation select-none"
```
- **Exact px caps, NOT spacing-scale utilities** — this app's root font-size is 18px, so `max-h-20`/`min-h-10`/`max-w-20` compute to 90/45/90px (verified live); arbitrary px values keep the promised 80px cap / 40px floor
- `h-full` fills the row height (≈72–80px on desktop — same as today)
- `max-h-[80px]` caps growth on tall screens → desktop parity preserved
- `min-h-[40px]` touch-comfortable floor
- `w-full max-w-[80px]` fills the column up to 80px (replaces `aspect-square`, which could not shrink)
- `touch-manipulation` removes double-tap-zoom delay; `select-none` prevents long-press text selection
- Digit/submit text scales instead of fixed `text-3xl`: `text-[clamp(0.9rem,4dvh,1.875rem)]`
- Submit arrow (line 250): `w-[clamp(1.25rem,4dvh,40px)] h-[clamp(1.25rem,4dvh,40px)] stroke-[2.5]`
- All existing colors, hover/active effects, borders, and rounded-xl stay unchanged

### 2a. Responsive wording (added on operator request mid-implementation)
Measured on a 390px phone: the header title at `min(6dvh,60px)` rendered ~51px and **wrapped to two 116px lines**, and "Enter LOGIN PIN" stayed desktop-sized — both eating keypad space. Made both viewport-width-aware (desktop values unchanged):
- Header title (line 167): `text-[clamp(1.125rem,min(6dvh,5.5vw),3.75rem)]` — phone ≈21px single line (was 2 lines × 58px), desktop 800px viewport = 48px = identical to today's `min(6vh,60)`
- Card title (line 183): `text-[clamp(1rem,min(4dvh,4.5vw),2.25rem)]` — phone ≈17.5px, desktop = 32px = identical to today's `min(4vh,36)`
- Result on 390×844: keys grew from 47px to a full **80px** tall from the freed space

### 3. No more silent clipping
Card inner container (line 182): `overflow-hidden` → `overflow-y-auto overscroll-contain` — a safety net so on extreme screens (tiny landscape phones with the 40px key floor active) the keypad scrolls into view instead of being cut off. With fixes 1+2 normal phones and tablets will not scroll at all.

### 4. Short-screen header compaction (landscape phones only)
Header/logo/title get `[@media(max-height:560px)]:` overrides so rotated phones fit everything without scrolling. Zero effect above 560px height (all desktops/terminals/portrait phones):
- Section (line 161): add `[@media(max-height:560px)]:pt-2 [@media(max-height:560px)]:pb-1`
- Logo (line 165): add `[@media(max-height:560px)]:h-[clamp(2.75rem,9dvh,6rem)] [@media(max-height:560px)]:w-[clamp(2.75rem,9dvh,6rem)] [@media(max-height:560px)]:mb-2`
- Title (line 167): add `[@media(max-height:560px)]:text-[clamp(1rem,4dvh,1.75rem)] [@media(max-height:560px)]:my-1`

### 5. Exit button — browser-aware render
In `Login()` (after `useAuthStore`, ~line 111):
```ts
const isElectron = typeof window !== "undefined" && !!window.electron
```
Wrap the Exit button JSX (lines 153–159) in `{isElectron && (…)}`. Desktop app: unchanged. Phone browser: button gone (was a dead confirm popup).

## Files to modify
- `desktop/ui/pages/Login.tsx` (only file)

## Verification plan
1. `npx tsc --noEmit` + `npm run lint` — clean.
2. Playwright against local dev servers (`npm run dev:backend` on 3001 + `npm run dev:react:local` so the ConnectionGate reaches the API and renders Login):
   - Viewports: **390×844** (iPhone Pro portrait), **360×740** (small Android), **844×390** (landscape), **768×1024** (tablet), **1280×800** (desktop parity check).
   - At each size, assert via `getBoundingClientRect()` that all 12 keys + PIN dots are fully inside `window.innerWidth/innerHeight` (no clipping, no scroll needed except tiny-landscape fallback).
   - Tap `1`–`2`–`3`–`4`: dots fill progressively, submit enables (gold), tap submit → loading state fires.
   - Tap ✕: PIN shrinks by one digit.
   - Confirm Exit button absent in browser context.

### Verified (2026-10-10, results)
| Viewport | 12 keys inside | Key size (w×h) | Header title | Card scroll |
|---|---|---|---|---|
| 390×844 | ✓ | 26×80 | 21px, one line | none |
| 360×740 | ✓ | 25×69 | one line | none |
| 844×390 landscape | ✓ | 80×44 | one line (compaction active) | none |
| 768×1024 | ✓ | 80×80 | one line | none |
| 1280×800 desktop | ✓ | 80×80 | 48px = today's value | none |
- Interaction: 1-2-3-4 → dots filled, submit enabled → **real login succeeded** (navigated to `#/admin`); ✕ removes digits and disables submit; Exit button count in browser = 0. `tsc -b` clean; Login.tsx lints clean; repo total unchanged at 785 pre-existing errors elsewhere.

## Workflow & deployment
1. Branch `feature/admin/login-responsive-keypad` off `restaurant-build`.
2. Generate via `deepseek-coder:latest` (Ollama), review/apply, run checks (per repo skills).
3. Merge to `restaurant-build`, push.
4. SSH to server: `git pull` → `npm run build` → `npm run build:web -- --server same-origin` (re-bakes the served bundle per AGENTS.md rule after a plain build). **No backend rebuild, no `EraevaBackend` restart** — static UI only. Installed .exe terminals keep their packaged bundle (unaffected, as intended).
5. User verifies on phone at `http://192.168.100.45:3001`.

---
Status: Ready to Execute
Branch: `feature/admin/login-responsive-keypad`
Plan reference: `context/fix-plan/login-responsive-keypad.md`
