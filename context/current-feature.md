# Current Feature

## Platform

frontend

## Status

In Progress

## Goals

- Waiter accompaniment picker is decluttered for the small POS window: only ONE accompaniment group visible at a time
- Free group shown by default (ugali, chapati, rice, etc.) with a "None" card always present — selecting None serves the dish WITHOUT that accompaniment (starch or vegetables)
- Charged group is a compact Free/Charged toggle — tapping Charged hides the free cards and reveals charged options (e.g. Ugali Brown), tapping Free restores them; toggling never clears an existing selection
- Toggle opens on the group containing the dish's currently-selected default (free default → Free; charged default e.g. Ugali Brown → Charged)
- "None" is captured end-to-end: order line stores null starchId/vegetableId, order column shows a "None" chip, customer + kitchen receipts print "No starch"/"No vegetables"
- Add-to-Order is no longer blocked when no accompaniment is chosen (None is always valid); only the sold-out state disables it
- Pricing rule unchanged: line total = (unit + chargedStarch + chargedVeg) × qty; multi-variant lines intact
- Branch: `feature/waiter/accompaniment-picker-none`

## Notes

- UI lives entirely in `desktop/ui/pages/waiterPos/WaiterMenuGrid.tsx`: new `AccompModeToggle` (Free/Charged segmented pills), `NoneAccompanyCard` (dashed card with Ban icon, radio value sentinel `NO_ACCOMPANIMENT = "none"`), `NoAccompanyRow` (order-column "None" chip). `selectStarch(null)`/`selectVegetable(null)` already existed and sync to the cart via `syncSelection`; null line keys (`menuId||veg`) create their own variant line.
- Mode state per category (`starchMode`/`vegMode`) reset in the dish-selection sync block to follow the pre-selected default's price.
- Section gates switched from `starchId`/`vegetableId` to `(hasStarch || starchId != null)` / `(hasVegetable || vegetableId != null)` so the picker + None still show for dishes with accompaniments but no configured default.
- Receipt notes: `WaiterMenu.tsx toReceiptItems` appends `{ name: "No starch"|"No vegetables", note: true }` when `menuItem.hasStarch/hasVegetable` is true but the accompaniment is null; `ReceiptAccompaniment.note?: boolean` added in `receiptTemplate.ts` + `electron.d.ts`, `accompHtml` renders note entries in italic without the FREE/+KSH tag. Works for void-prefill lines too (real MenuItems carry hasStarch/hasVegetable).
- Backend: `routes/orders.ts` no longer throws when `menu.hasStarch/hasVegetable` is true but the order item omits starchId/vegetableId — `hasStarch`/`hasVegetable` are informational only (drives the UI sections). No schema change; OrderItem already persists null.
- Admin MenuForm default-requirement (LUNCH/DINNER need a configured default) untouched — it only sets the default, the waiter can still pick None at order time.
- Verification: root `tsc -b` + backend `tsc` pass; full-repo `npm run lint` has many pre-existing errors but none introduced by this feature (WaiterMenuGrid.tsx:140 `setImgFailed` effect error is pre-existing).

## History

### frontend - 2026-09-12 — Waiter Accompaniment Picker Redesign + "None" Option
- Waiter detail panel now shows accompaniments via the Free/Charged toggle: Free group (with an always-present "None" card) is the default view; tapping Charged hides free cards and shows charged options (Ugali Brown, etc.); tapping Free restores them; toggling never clears a selection
- "None" is a real fourth selection: captured as null starchId/vegetableId on the order, shown as a "None" chip in the order column, and printed as "No starch"/"No vegetables" on both the customer and kitchen tickets (note-style, no FREE/+KSH tag)
- Add-to-Order no longer disabled for missing accompaniments; backend `orders.ts` requirement relaxed accordingly (no schema change)
- Occurrence in `WaiterMenuGrid.tsx`, `WaiterMenu.tsx`, `receiptTemplate.ts`, `electron.d.ts`, `backend/routes/orders.ts`
- Branch: `feature/waiter/accompaniment-picker-none`