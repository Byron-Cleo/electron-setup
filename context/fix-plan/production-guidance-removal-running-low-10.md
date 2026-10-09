# Production Guidance Removal + Running Low Threshold 5 → 10

## Branch
`feature/admin/remove-production-guidance`

## Problem
1. **Redundant section**: the Menu/Dispatch home dashboard has three sections — 3 navigation cards,
   Menu Plate Movement, then Production Guidance. The Production Guidance table is a less clear
   duplicate of what Menu Plate Movement already shows directly (Selling Now / Running Low / Sold Out),
   so the operator does not see its relevance on this dashboard.
2. **Running Low warns too late**: the Menu Plate Movement "Running Low" bucket only triggers at
   ≤ 5 plates. The operator wants visibility from ≤ 10 plates.

## Solution
Dashboard becomes two sections: 3 cards → Menu Plate Movement (last section). The running-low
definition moves from 5 to 10 plates in both the Menu Plate Movement section and the waiter POS
grid cues.

### 1. Remove the Production Guidance section
- `desktop/ui/pages/admin/Menu.tsx` — remove the import (L14) and the dashboard usage
  (L176: `{view === "dashboard" && <ProductionGuidanceCard />}`)
- **DELETE** `desktop/ui/components/menu/ProductionGuidanceCard.tsx` — its only consumer is Menu.tsx
  (verified). It carried a local `RUNNING_LOW_THRESHOLD = 5`, irrelevant once the file is gone.

### 2. API decision — kept, NOT dead code
- The card fed from `getMenuStockStatus()` → `GET /api/menu/stock-status`, which is **still used by
  `MenuStockStatusCard`** (the Menu Plate Movement section). Per the operator's rule
  ("if the API is anywhere in the app, leave it"), the endpoint, `lib/api.ts` helper, and
  `ipc-handlers.ts` proxy all stay untouched.

### 3. Running Low threshold 5 → 10
- `backend/routes/menu.ts` L247 — `const RUNNING_LOW_THRESHOLD = 5;` → `10`
  (drives the `runningLow` bucket of `/api/menu/stock-status`)
- `desktop/ui/components/menu/MenuStockStatusCard.tsx` L187 — section title
  `"Running Low (≤ 5)"` → `"Running Low (≤ 10)"`
- `desktop/ui/pages/waiterPos/WaiterMenuGrid.tsx` (operator opted in for consistency):
  - L414 — `const runningLow = servings > 0 && servings <= 5` → `<= 10`
  - L415 — `const inStock = servings > 5` → `> 10`
  - L97 — `platesBadgeClass`: green when `plates > 5` → `plates > 10`
    (used by the grid card badge, the detail panel badge, and the order-context badges)
- **Expected side effect (consistent, not a bug):** the admin sidebar badge via
  `GET /api/menu/running-low-count` (`AdminLayout.tsx`) shares the same backend constant, so it
  will now count items with 1–10 plates.

### 4. DESSERT meal period — untouched (decision reversed)
- The operator initially asked to remove DESSERT from the Menu Plate Movement chips and the waiter
  POS UI, then reversed it mid-planning: a dish falls under DESSERT. **No meal-period changes** —
  `MEAL_PERIODS` keeps BREAKFAST / LUNCH / DINNER / DESSERT / BEVERAGE everywhere (chips, waiter
  landing cards, ServingPeriodBar, AllMenuTable, MealPeriod Prisma enum).

### 5. Dashboard cards — rename + reorder (added mid-feature)
- Rename the third dashboard card **"Remaining Stock Production" → "Leftover Food Stock"** — operator
  iterated: "Leftover Stock" → "Leftover Food Stock"; the destination view title
  (`RemainingStockDashboard.tsx` L141) was updated in step so card and page match
- Reorder the 3 cards: **1. Today's Cooked Food → 2. Leftover Stock → 3. All Restaurant Menu** (far end)
- Icons, badges, copy, and click targets stay byte-identical — only the two Card blocks swap position
  and one heading string changes
- Applied manually by the operator's decision after deepseek-coder produced unusable output for the
  reorder (invented a new file + a phantom 4th card); fallback rule invoked

### 6. Receipt / report font — single-constant candidate testing (added mid-feature)
- All printed surfaces (customer/kitchen/bar tickets, shift report, printer TEST page) share one
  `documentHtml()` wrapper — the font is now a single exported `RECEIPT_FONT` stack in `receiptTemplate.ts`
- Applied to: `documentHtml` body, the space-aligned plate-movement `<pre>` (must stay monospace), and the
  printer test page in `receipt.ts`
- **Candidate 1 (current): Consolas** — `'Consolas, Menlo, DejaVu Sans Mono, Courier New, monospace'`
  (Windows built-in on the restaurant machine; Menlo covers Mac dev)
- Candidate queue: 2 Lucida Console (Windows), 3 Verdana (proportional — pre keeps mono fallback),
  4 DejaVu Sans Mono (bundle), 5 IBM Plex Mono / Roboto Mono / Courier Prime (bundle)
- Test cycle: edit the one `RECEIPT_FONT` line → `npm run transpile:electron` → print a test order + shift report

### 7. Receipt/report footers — Mobile Applications rename + shift-report footer fix (added mid-feature)
- Footer `services` string now reads: "Hotel Systems, Supermarket Systems, Website Apps, Mobile Applications"
  (was "…Web Design…, Mobile Development"; operator iterating: Web Design → Website Applications and
  Design → "Website Apps"; Mobile Development → "Mobile Applications"). An "AI Chatbots & WhatsApp
  Ordering" line was added, then **withdrawed by operator decision ("for now")** — printed nowhere
- Applied to: waiter customer receipt print + preview payloads (`WaiterMenu.tsx`), and the raw ESC/POS
  path prints `r.services` automatically (`receipt.ts`)
- **Shift report printing gained the Apydy footer** — the template previously never rendered
  poweredBy/tel/services (body stopped at payments); `shiftReportBody` now ends with the same
  "POS Designed and Build By:" block, and both report payloads (`ShiftReport.tsx`, `ShiftCloseDialog.tsx`)
  carry the services line

### 8. Menu item edit/create dialog — two-column layout (added mid-feature)
- Problem: selecting **Sold in Portions = Yes** expanded the portion cards vertically in the single-column
  modal, pushing Save out of reach on the restaurant screen
- `MenuForm.tsx` restructured into a side-by-side grid (`grid-cols-1 md:grid-cols-[2fr_3fr] gap-6`):
  - **Left column**: name, category, price, images, meal periods
  - **Right column**: Served with Starch? and Served with Vegetable? radios **side by side**
    (`grid grid-cols-2 gap-4`, each with its conditional select, per operator), then "Sold in Portions?"
    below them + the portion-option cards, the list capped at
    `max-h-[55vh] overflow-y-auto` so many portions scroll internally instead of stretching the dialog
  - **Cancel/Save centered** — `flex justify-center` below both columns, spanning the full modal width
    (operator: "center placed on the modal window")
- `CreateMenuDialog.tsx` widened `sm:max-w-lg` → `sm:max-w-4xl`, then trimmed to **`sm:max-w-3xl`**
  (operator: "too long" horizontally); form Card `mx-auto max-w-lg` → `w-full`
- Applies to both New Menu Item and Edit Menu Item (same `MenuForm`)

## Files Modified
| File | Changes |
|------|---------|
| `desktop/ui/pages/admin/Menu.tsx` | Remove `ProductionGuidanceCard` import (L14) + dashboard usage (L176); cards reordered — Leftover Stock (renamed) 2nd, All Restaurant Menu 3rd |
| `desktop/ui/components/menu/ProductionGuidanceCard.tsx` | DELETE the component file (only consumer is Menu.tsx) |
| `backend/routes/menu.ts` | `RUNNING_LOW_THRESHOLD` 5 → 10 (L247) |
| `desktop/electron/receiptTemplate.ts` | New exported `RECEIPT_FONT` constant (candidate 1: Consolas) applied in `documentHtml` + plate-movement `<pre>`; shift report body now ends with the Apydy footer (POS Designed and Build By / poweredBy / Tel / services — previously never printed) |
| `desktop/electron/receipt.ts` | Printer TEST page uses `RECEIPT_FONT` instead of hardcoded Courier New |
| `desktop/ui/pages/waiterPos/WaiterMenu.tsx` | Receipt print + preview footer `services`: "Mobile Applications" rename (AI line added then withdrawn by operator) |
| `desktop/ui/components/reports/ShiftReport.tsx` | Report payload gains the `services` footer line |
| `desktop/ui/components/shift/ShiftCloseDialog.tsx` | Report payload gains the `services` footer line |
| `desktop/ui/components/MenuForm.tsx` | Two-column layout — left: dish fields; right: starch/vegetable radios **side by side** + Sold in Portions below with portion cards (`max-h-[55vh]` internal scroll); **Cancel/Save centered** below both columns; Card `w-full` |
| `desktop/ui/components/menu/CreateMenuDialog.tsx` | Dialog width `sm:max-w-lg` → `sm:max-w-3xl` |
| `desktop/ui/components/menu/MenuStockStatusCard.tsx` | "Running Low (≤ 5)" → "Running Low (≤ 10)" (L187) |
| `desktop/ui/pages/waiterPos/WaiterMenuGrid.tsx` | `runningLow` / `inStock` cutoffs (L414–415) + `platesBadgeClass` green cutoff (L97): 5 → 10; menu food cards compacted — `py-0` on the food Card strips the shared Card primitive's built-in 16px vertical padding (`CardContent p-3` remains the breathing room); accompaniment radio option cards (`AccompanyRadioCard` + `NoneAccompanyCard`) vertically compacted — `p-1.5` / `gap-1` / image `h-8` / radio `size-3.5`, None icon `h-5`; Size portion rows `py-1` — Free/Charged toggle untouched |

## Testing Checklist
- [ ] Menu/Dispatch dashboard shows only: 3 cards + Menu Plate Movement (Production Guidance gone)
- [ ] Card order: Today's Cooked Food, **Leftover Food Stock**, All Restaurant Menu (far end); the renamed card still opens the Leftover Food Stock view
- [ ] Menu Plate Movement "Running Low (≤ 10)" bucket lists items with 1–10 plates
- [ ] Items with > 10 plates appear only in "Selling Now"
- [ ] Waiter POS grid cards show the running-low colour at ≤ 10 servings, green above
- [ ] Waiter menu food cards render compact (no built-in 16px top/bottom padding) — more dishes visible per screen
- [ ] Served With / Vegetable radio option cards (incl. None) render shorter — detail panel reaches Add to Order on the restaurant screen without scrolling; Free/Charged toggle unchanged
- [ ] Detail panel and order-context plate badges use the 10 cutoff
- [ ] Admin sidebar running-low badge reflects the ≤ 10 count
- [ ] DESSERT still selectable everywhere (plate movement chips, waiter POS landing, AllMenuTable)
- [ ] `npm run lint` clean; `npm run build` (tsc + vite) clean

## Verification
- `npm run lint`
- `npm run build` (frontend)
- `npm run build --prefix backend` (backend compiles; only a constant changed)

## Deploy — DEFERRED until the operator dev-tests
Per AGENTS.md production deployment (backend changed):
1. `npm run build --prefix backend`
2. `npm run server:restart` (elevated shell) or `schtasks /run /tn pos-backend-restart` over SSH
3. Verify: `npm run server:status` → RUNNING and `curl http://localhost:3001/health` → ok

Browser live-view rule: after any plain `npm run build` / `build:win`, re-run
`npm run build:web -- --server same-origin` so the served web UI stays browser-correct.

## Related
- `context/fix-plan/operation-date-unassigned-carryover.md` — earlier plan referencing Production Guidance
- `context/fix-plan/shift-reporting-update.md` — plate-movement semantics this card mirrored
