import { Router } from "express";
import prisma from "../db/db.js";
import {
  computeCurrentCycle,
  computeExpiredUnassignedBatches,
  computeWastedBatches,
  computeAssignedLeftovers,
  computeAdjustableStock,
  openingSource,
} from "./shiftCarryOver.js";
import {
  recomputeMenuStockWithSiblings,
  wasteMenuPlates,
  wasteSupplyPool,
  adjustMenuPlates,
  adjustSupplyPool,
  adjustDirectSaleStock,
  round2,
} from "../pools.js";
import { resolveCurrentShift } from "./orders.js";
import { SellingMode } from "../db/generated/prisma/client.js";
import { emitLiveEvent } from "../events.js";

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/stock/wasted - All batches marked as wasted via the Waste action.
// Wasted batches are attributed to the operation date they were PRODUCED on, so
// the final report of a production op-date always ties its waste back to it,
// regardless of when the Waste action was pressed.
router.get("/wasted", async (_req, res) => {
  try {
    const cycle = await computeCurrentCycle();
    const { batches } = await computeWastedBatches(cycle);
    res.json({ wastedBatches: batches });
  } catch (e) {
    console.error("Error fetching wasted stock:", e);
    res.status(500).json({ error: "Failed to fetch wasted stock" });
  }
});

// GET /api/stock/assigned-leftovers - Every leftover that still needs a decision,
// grouped by stage so there is a single source of truth:
//   - current: assigned/cooked plates for the operation date running now
//   - previous: assigned/cooked plates from earlier operation dates (on a menu,
//     unsold) that were never carried over or wasted
//   - unassigned: raw batches cooked on earlier operation dates but never put on a
//     menu (not sellable, not in stock) — carried over manually or wasted
// Carry-over is the default; the Waste action discards here.
router.get("/assigned-leftovers", async (_req, res) => {
  try {
    const cycle = await computeCurrentCycle();
    if (cycle === null) {
      return res.json({
        cycle: null,
        currentOperationDay: null,
        current: [],
        previous: [],
        unassigned: [],
      });
    }
    const { rows } = await computeAssignedLeftovers(cycle);
    const { batches: unassigned } = await computeExpiredUnassignedBatches(cycle);
    const currentOperationDay = cycle.operationDay.toISOString().slice(0, 10);
    res.json({
      cycle: {
        cycleStart: cycle.cycleStart,
        cycleEnd: cycle.cycleEnd,
        operationDay: cycle.operationDay,
      },
      currentOperationDay,
      current: rows.filter((row) => row.operationDay === currentOperationDay),
      previous: rows.filter((row) => row.operationDay !== currentOperationDay),
      unassigned,
    });
  } catch (e) {
    console.error("Error fetching assigned leftovers:", e);
    res.status(500).json({ error: "Failed to fetch assigned leftovers" });
  }
});

// POST /api/stock/assigned-leftovers/waste - Discard sellable plates as waste.
// Body: { plates: number, menuId?: string, stockSupplyId?: string }. A menuId
// drains that dish's splits FIFO then any shared pool it draws on; a
// stockSupplyId drains that supply's shared pools (affecting every linked dish).
router.post("/assigned-leftovers/waste", async (req, res) => {
  const body = (req.body ?? {}) as { menuId?: string; stockSupplyId?: string; plates?: number };
  const amount = Number(body.plates);
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: "plates must be a positive number" });
  }
  if (!body.menuId && !body.stockSupplyId) {
    return res.status(400).json({ error: "menuId or stockSupplyId is required" });
  }

  try {
    const wasted = await prisma.$transaction(async (tx) => {
      if (body.menuId) {
        const w = await wasteMenuPlates(tx, body.menuId, amount);
        await recomputeMenuStockWithSiblings(tx, body.menuId);
        return w;
      }
      const w = await wasteSupplyPool(tx, body.stockSupplyId as string, amount);
      const links = await tx.stockSupplyMenu.findMany({
        where: { stockSupplyId: body.stockSupplyId },
        select: { menuId: true },
      });
      for (const link of links) {
        await recomputeMenuStockWithSiblings(tx, link.menuId);
      }
      return w;
    });

    emitLiveEvent({ type: "pool.updated", at: new Date().toISOString() });
    res.json({ wasted });
  } catch (e) {
    console.error("Error wasting assigned stock:", e);
    res.status(500).json({ error: "Failed to waste stock" });
  }
});

// POST /api/stock/wasted/:cookingRecordId/unwaste - Reverse a waste action on a batch.
// Body: { plates?: number }. When plates is omitted, the batch's entire recorded
// waste is reversed. Two cases:
//   - A disposed batch (unassigned waste): fully un-disposed — its unassigned
//     plates return to the carry-over pool.
//   - A batch with wastedPlates (assigned-leftovers waste): the given amount is
//     removed from wastedPlates. For ALLOCATED batches the plates are also
//     restored to their splits (oldest first, mirroring how the waste drained
//     them), so the dish's sellable stock returns too.
router.post("/wasted/:cookingRecordId/unwaste", async (req, res) => {
  const { cookingRecordId } = req.params;
  const body = (req.body ?? {}) as { plates?: number };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const batch = await tx.cookingRecord.findUnique({
        where: { id: cookingRecordId },
        select: {
          id: true,
          disposed: true,
          wastedPlates: true,
          sellingMode: true,
          stockSupply: { select: { menus: { select: { menuId: true } } } },
          cookingRecordMenus: {
            select: { id: true, platesAllocated: true, platesRemaining: true },
            orderBy: { createdAt: "asc" },
          },
        },
      });
      if (!batch) throw new Error("Cooking record not found");

      // Case 1: disposed batch — full un-dispose restores the unassigned plates.
      if (batch.disposed) {
        await tx.cookingRecord.update({
          where: { id: cookingRecordId },
          data: { disposed: false, disposedAt: null },
        });
        for (const sm of batch.stockSupply.menus) {
          await recomputeMenuStockWithSiblings(tx, sm.menuId);
        }
        return { unwasted: "all", disposed: false };
      }

      // Case 2: wastedPlates path — reverse up to the recorded waste.
      const max = Number(batch.wastedPlates ?? 0);
      if (max <= 0) throw new Error("No recorded waste to reverse on this batch");
      const requested = body.plates !== undefined ? Number(body.plates) : max;
      if (!Number.isFinite(requested) || requested <= 0) {
        throw new Error("plates must be a positive number");
      }
      const amount = Math.min(requested, max);

      // ALLOCATED: restore the drained plates to the splits (oldest first — the
      // same order the waste drained them), so both allocated and remaining —
      // and therefore the dish's sellable stock — come back.
      if (batch.sellingMode === SellingMode.ALLOCATED) {
        let left = amount;
        for (const split of batch.cookingRecordMenus) {
          if (left <= 0) break;
          const give = Math.min(Number(split.platesAllocated), left);
          if (give <= 0) continue;
          await tx.cookingRecordMenu.update({
            where: { id: split.id },
            data: {
              platesAllocated: { increment: give },
              platesRemaining: { increment: give },
            },
          });
          left -= give;
        }
      }

      await tx.cookingRecord.update({
        where: { id: cookingRecordId },
        data: { wastedPlates: { decrement: amount } },
      });

      for (const sm of batch.stockSupply.menus) {
        await recomputeMenuStockWithSiblings(tx, sm.menuId);
      }
      return { unwasted: amount, disposed: false };
    });

    emitLiveEvent({ type: "pool.updated", at: new Date().toISOString() });
    res.json(result);
  } catch (e) {
    console.error("Error unwasting stock:", e);
    const msg = e instanceof Error ? e.message : "Failed to unwaste stock";
    res.status(500).json({ error: msg });
  }
});

// GET /api/stock/adjustable-stock - The "adjust to actual" universe, split into
// Carry Forward (opening > 0) and Cooked-this-shift rows, with the source
// operation date the carry-over came from.
router.get("/adjustable-stock", async (_req, res) => {
  try {
    const data = await computeAdjustableStock();
    res.json({
      ...data,
      currentOperationDay: data.currentShift?.operationDay ?? null,
    });
  } catch (e) {
    console.error("Error fetching adjustable stock:", e);
    res.status(500).json({ error: "Failed to fetch adjustable stock" });
  }
});

// POST /api/stock/assigned-leftovers/adjust - Set a dish's/shared pool's stock
// to the true physical count (`actual`). A stock CORRECTION, not a waste:
// wastedPlates and sales are untouched.
//
// When the target carried over into the current shift (its opening snapshot is
// > 0) this is an OPENING adjustment: the current shift's `openingPlates` is set
// to `actual` AS WELL AS the live ledger, so the corrected figure is what the
// shift reports as its opening stock. Otherwise it corrects the live count only.
//
// Body:
//   { menuId?: string, stockSupplyId?: string, actual: number, userId?: string, reason?: string }
router.post("/assigned-leftovers/adjust", async (req, res) => {
  const body = (req.body ?? {}) as {
    menuId?: string;
    stockSupplyId?: string;
    actual?: number;
    userId?: string;
    reason?: string;
  };
  const actual = round2(Number(body.actual));
  if (!Number.isFinite(actual) || actual < 0) {
    return res.status(400).json({ error: "actual must be a non-negative number" });
  }
  if (!body.menuId && !body.stockSupplyId) {
    return res.status(400).json({ error: "menuId or stockSupplyId is required" });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const shift = await resolveCurrentShift();
      const source = shift ? openingSource(shift) : null;

      let before: number;
      let after: number;
      let openingBefore: number | null = null;
      let openingAfter: number | null = null;
      let auditSupplyId: string | null;
      let auditMenuId: string | null = null;

      const setOpening = async (menuId: string) => {
        if (!shift) return;
        const snap = await tx.shiftSnapshot.findUnique({
          where: { shiftId_menuId: { shiftId: shift.id, menuId } },
          select: { openingPlates: true },
        });
        if (!snap || Number(snap.openingPlates) <= 0) return;
        if (openingBefore === null) openingBefore = round2(Number(snap.openingPlates));
        await tx.shiftSnapshot.update({
          where: { shiftId_menuId: { shiftId: shift.id, menuId } },
          data: { openingPlates: actual },
        });
        openingAfter = actual;
      };

      if (body.menuId) {
        const menu = await tx.menu.findUnique({
          where: { id: body.menuId },
          select: { requiresCooking: true },
        });
        if (!menu) throw new Error("Dish not found");

        if (menu.requiresCooking === false) {
          const r = await adjustDirectSaleStock(tx, body.menuId, actual);
          before = r.before;
          after = r.after;
        } else {
          const r = await adjustMenuPlates(tx, body.menuId, actual);
          before = r.before;
          after = r.after;
          await recomputeMenuStockWithSiblings(tx, body.menuId);
        }
        auditMenuId = body.menuId;
        const link = await tx.stockSupplyMenu.findFirst({
          where: { menuId: body.menuId },
          select: { stockSupplyId: true },
        });
        auditSupplyId = link?.stockSupplyId ?? null;
        await setOpening(body.menuId);
      } else {
        const supplyId = body.stockSupplyId as string;
        const r = await adjustSupplyPool(tx, supplyId, actual);
        before = r.before;
        after = r.after;
        auditSupplyId = supplyId;
        const links = await tx.stockSupplyMenu.findMany({
          where: { stockSupplyId: supplyId },
          select: { menuId: true },
        });
        for (const link of links) {
          await recomputeMenuStockWithSiblings(tx, link.menuId);
          await setOpening(link.menuId);
        }
      }

      const isOpening = openingBefore !== null;
      const reason =
        body.reason?.trim() ||
        (isOpening
          ? `Opening stock corrected to physical count — carried over from ${source?.sourceDate ?? "the previous"} ${source?.sourceShiftType ?? ""} shift`.trim()
          : "Stock corrected to physical count");

      await tx.stockAdjustment.create({
        data: {
          stockSupplyId: auditSupplyId,
          menuId: auditMenuId,
          userId: body.userId && UUID_RE.test(body.userId) ? body.userId : null,
          action: isOpening ? "OPENING_ADJUST" : "LEFTOVER_ADJUST",
          delta: after - before,
          amountBefore: before,
          amountAfter: after,
          reason,
        },
      });

      return {
        before,
        after,
        delta: round2(after - before),
        openingBefore,
        openingAfter,
        action: isOpening ? "OPENING_ADJUST" : "LEFTOVER_ADJUST",
      };
    });

    emitLiveEvent({ type: "pool.updated", at: new Date().toISOString() });
    res.json(result);
  } catch (e) {
    console.error("Error adjusting stock to actual:", e);
    const msg = e instanceof Error ? e.message : "Failed to adjust stock";
    res.status(500).json({ error: msg });
  }
});

export default router;