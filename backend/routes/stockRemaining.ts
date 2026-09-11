import { Router } from "express";
import prisma from "../db/db.js";
import {
  findPreviousClosedShift,
  computeCurrentCycle,
  computeAllUnassignedBatches,
  computeExpiredUnassignedBatches,
  computeWastedBatches,
} from "./shiftCarryOver.js";

const router = Router();

interface CarryForwardRow {
  menuId: string;
  menuName: string;
  closingPlates: number;
  stockSupplyId: string | null;
  stockSupplyName: string | null;
}

// GET /api/stock/remaining - Carry-forward stock + unassigned batches for the
// current operation date, so carry-over can be assigned to menus. Unassigned
// batches are split into:
//   - unassignedBatches: produced inside the current operation-date window (valid,
//     assignable, with shift/op-date attribution).
//   - expiredBatches: unassigned production from BEFORE the current window
//     (validUnassigned = 0 — must be decided on: carry over manually or waste).
router.get("/remaining", async (_req, res) => {
  try {
    const cycle = await computeCurrentCycle();
    const previousShift = await findPreviousClosedShift();

    const cycleBatchResult =
      cycle !== null
        ? await computeAllUnassignedBatches(cycle)
        : { batches: [] };
    const expiredBatchResult =
      cycle !== null
        ? await computeExpiredUnassignedBatches(cycle)
        : { batches: [] };

    let carryForwardPerMenu: CarryForwardRow[];

    if (!previousShift) {
      // Fresh install — no shift has ever closed. Fall back to live Menu.stock,
      // which already has sold deducted and is what the next shift carries over.
      const activeMenus = await prisma.menu.findMany({
        where: { isAvailable: true, stock: { gt: 0 } },
        select: {
          id: true,
          name: true,
          stock: true,
          stockSupplyMenus: { select: { stockSupply: { select: { id: true, name: true } } } },
        },
      });
      carryForwardPerMenu = activeMenus.flatMap((menu): CarryForwardRow[] => {
        const links = menu.stockSupplyMenus ?? [];
        if (links.length === 0) {
          return [
            {
              menuId: menu.id,
              menuName: menu.name,
              closingPlates: Number(menu.stock),
              stockSupplyId: null,
              stockSupplyName: null,
            },
          ];
        }
        return links.map((link) => ({
          menuId: menu.id,
          menuName: menu.name,
          closingPlates: Number(menu.stock),
          stockSupplyId: link.stockSupply.id,
          stockSupplyName: link.stockSupply.name,
        }));
      });
    } else {
      // Carry-forward per menu = the previous shift's closing snapshot plates.
      // Each row pairs a menu with one of its linked stock supplies.
      carryForwardPerMenu = previousShift.snapshots
        .filter((snap) => Number(snap.closingStockAtManualClose) > 0)
        .flatMap<CarryForwardRow>((snap) => {
          const links = snap.menu.stockSupplyMenus ?? [];
          if (links.length === 0) {
            return [
              {
                menuId: snap.menu.id,
                menuName: snap.menu.name,
                closingPlates: Number(snap.closingStockAtManualClose),
                stockSupplyId: null,
                stockSupplyName: null,
              },
            ];
          }
          return links.map((link) => ({
            menuId: snap.menu.id,
            menuName: snap.menu.name,
            closingPlates: Number(snap.closingStockAtManualClose),
            stockSupplyId: link.stockSupply.id,
            stockSupplyName: link.stockSupply.name,
          }));
        });
    }

    res.json({
      previousShift: previousShift
        ? {
            id: previousShift.id,
            type: previousShift.type,
            operationDay: previousShift.operationDay,
            closeTime: previousShift.autoClosedAt,
          }
        : null,
      cycle: cycle
        ? {
            cycleStart: cycle.cycleStart,
            cycleEnd: cycle.cycleEnd,
            operationDay: cycle.operationDay,
          }
        : null,
      carryForwardPerMenu,
      unassignedBatches: cycleBatchResult.batches,
      expiredBatches: expiredBatchResult.batches,
    });
  } catch (e) {
    console.error("Error fetching remaining stock:", e);
    res.status(500).json({ error: "Failed to fetch remaining stock" });
  }
});

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

export default router;