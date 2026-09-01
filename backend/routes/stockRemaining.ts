import { Router } from "express";
import prisma from "../db/db.js";
import { findPreviousClosedShift, computeShiftUnassignedBatches } from "./shiftCarryOver.js";

const router = Router();

interface CarryForwardRow {
  menuId: string;
  menuName: string;
  closingPlates: number;
  stockSupplyId: string | null;
  stockSupplyName: string | null;
}

// GET /api/stock/remaining - Carry-forward stock + unassigned batches from the
// previous shift, so carry-over can be assigned to menus at the start of a new shift.
router.get("/remaining", async (_req, res) => {
  try {
    const previousShift = await findPreviousClosedShift();

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
      const carryForwardPerMenu: CarryForwardRow[] = activeMenus.flatMap((menu): CarryForwardRow[] => {
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
      return res.json({
        previousShift: null,
        carryForwardPerMenu,
        unassignedBatches: [],
      });
    }

    // Carry-forward per menu = the previous shift's closing snapshot plates.
    // Each row pairs a menu with one of its linked stock supplies.
    const carryForwardPerMenu: CarryForwardRow[] = previousShift.snapshots
      .filter((snap) => Number(snap.closingPlates) > 0)
      .flatMap<CarryForwardRow>((snap) => {
        const links = snap.menu.stockSupplyMenus ?? [];
        if (links.length === 0) {
          return [
            {
              menuId: snap.menu.id,
              menuName: snap.menu.name,
              closingPlates: Number(snap.closingPlates),
              stockSupplyId: null,
              stockSupplyName: null,
            },
          ];
        }
        return links.map((link) => ({
          menuId: snap.menu.id,
          menuName: snap.menu.name,
          closingPlates: Number(snap.closingPlates),
          stockSupplyId: link.stockSupply.id,
          stockSupplyName: link.stockSupply.name,
        }));
      });

    const { batches: unassignedBatches } = await computeShiftUnassignedBatches(previousShift);

    res.json({
      previousShift: {
        id: previousShift.id,
        type: previousShift.type,
        operationDay: previousShift.operationDay,
        closeTime: previousShift.autoClosedAt,
      },
      carryForwardPerMenu,
      unassignedBatches,
    });
  } catch (e) {
    console.error("Error fetching remaining stock:", e);
    res.status(500).json({ error: "Failed to fetch remaining stock" });
  }
});

export default router;