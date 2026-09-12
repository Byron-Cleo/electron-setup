# Current Feature

## Platform

Not Specified

## Status

Complete

## Goals

## Notes

## History

### frontend - 2026-09-12 — Waiter Accompaniment Picker Redesign + "None" Option
- Waiter detail panel now shows accompaniments via the Free/Charged toggle: Free group (with an always-present "None" card at the end) is the default view; tapping Charged hides free cards and shows charged options (Ugali Brown, etc.); tapping Free restores them; toggling never clears a selection
- "None" is a real fourth selection: captured as null starchId/vegetableId on the order, shown as a "None" chip in the order column, and printed as "No starch"/"No vegetables" on both the customer and kitchen tickets (note-style, no FREE/+KSH tag)
- Add-to-Order no longer disabled for missing accompaniments; backend `orders.ts` requirement relaxed accordingly (no schema change — OrderItem.starchId/vegetableId were already nullable)
- Occurrence in `WaiterMenuGrid.tsx`, `WaiterMenu.tsx`, `receiptTemplate.ts`, `electron.d.ts`, `backend/routes/orders.ts`
- Deployed: backend rebuilt (`npm run build --prefix backend`) + EraevaBackend service restarted, `/health` 200 on :3001; merged to `restaurant-build` (feature branch kept)
- Cleanup: removed stale committed duplicate client `backend/prisma/generated`, pm2 `ecosystem.config.cjs`, and `scripts/start-backend.bat`; `server:*` npm scripts repointed to the NSSM service
- Branch: `feature/waiter/accompaniment-picker-none`