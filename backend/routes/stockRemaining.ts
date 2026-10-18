import { Router } from "express";
import prisma from "../db/db.js";
import {
  computeCurrentCycle,
  computeExpiredUnassignedBatches,
  computeWastedBatches,
  computeAssignedLeftovers,
} from "./shiftCarryOver.js";
import { recomputeMenuStockWithSiblings, wasteMenuPlates, wasteSupplyPool } from "../pools.js";
import { SellingMode } from "../db/generated/prisma/client.js";
import { emitLiveEvent } from "../events.js";

const router = Router();

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

export default router;