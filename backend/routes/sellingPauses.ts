import { Router } from "express";
import prisma from "../db/db.js";
import { SellingMode } from "../db/generated/prisma/client.js";
import { round2, sellableForMenu } from "../pools.js";

const router = Router();

// Same Nairobi-date convention the scheduler and order-shift attribution use,
// so a pause always belongs to the operation day it was keyed under.
function dateOnly(d: Date): Date {
  const nakuru = new Date(d.getTime() + 3 * 60 * 60 * 1000);
  return new Date(Date.UTC(nakuru.getUTCFullYear(), nakuru.getUTCMonth(), nakuru.getUTCDate()));
}

function userRoles(user: { role: string; roles: string[] }): string[] {
  return user.roles?.length ? user.roles : [user.role];
}

/**
 * DB-backed authorization: only a known, active admin/manager may control
 * selling. The acting user is cited by id in the body (same convention as
 * `voidedById`), so the check is real — a waiter id is rejected here even
 * though the UI also hides the controls.
 */
async function requireController(userId: unknown) {
  if (typeof userId !== "string" || !userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true, roles: true, isActive: true },
  });
  if (!user || !user.isActive) return null;
  const roles = userRoles(user);
  if (!roles.includes("admin") && !roles.includes("manager")) return null;
  return user;
}

/** GET / — list pauses (open read; waiters get pausedPlates via the menu list). */
router.get("/", async (req, res) => {
  try {
    const { operationDay, shiftId, menuId, cookingRecordId, active } = req.query as Record<string, string | undefined>;
    const where: {
      operationDay?: Date;
      shiftId?: string;
      menuId?: string;
      cookingRecordId?: string | null;
      active?: boolean;
    } = {};
    if (operationDay) where.operationDay = dateOnly(new Date(operationDay));
    if (shiftId) where.shiftId = shiftId;
    if (menuId) where.menuId = menuId;
    if (cookingRecordId) where.cookingRecordId = cookingRecordId;
    if (active !== undefined) where.active = active === "true";
    const pauses = await prisma.sellingPause.findMany({
      where,
      include: {
        Menu: { select: { id: true, name: true } },
        CookingRecord: { select: { id: true, batchNumber: true, stockSupplyId: true, sellingMode: true } },
        PausedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(pauses);
  } catch (e) {
    console.error("Error listing selling pauses:", e);
    res.status(500).json({ error: "Failed to list selling pauses" });
  }
});

/**
 * POST / — create or update (upsert) one active pause for a scope:
 * ALLOCATED per split row, SHARED per batch, KEYED per menu (no batch).
 */
router.post("/", async (req, res) => {
  try {
    const {
      pausedById,
      menuId,
      cookingRecordId,
      sellingMode,
      pausedPlates,
      shiftId,
      operationDay,
      reason,
    } = req.body ?? {};
    const controller = await requireController(pausedById);
    if (!controller) return res.status(403).json({ error: "Only admin or manager can control selling" });
    if (!menuId || !sellingMode) return res.status(400).json({ error: "menuId and sellingMode are required" });
    if (!Object.values(SellingMode).includes(sellingMode)) {
      return res.status(400).json({ error: "sellingMode must be ALLOCATED, SHARED or KEYED" });
    }
    const pp = round2(Number(pausedPlates));
    if (!Number.isFinite(pp) || pp <= 0) return res.status(400).json({ error: "pausedPlates must be a number greater than 0" });

    const menu = await prisma.menu.findUnique({
      where: { id: menuId },
      select: { id: true, name: true, requiresCooking: true },
    });
    if (!menu) return res.status(404).json({ error: "Menu item not found" });

    // A cited shift must exist and still be open — pausing into a closed shift
    // would rewrite history the reports already sealed.
    if (shiftId) {
      const shift = await prisma.shift.findUnique({ where: { id: shiftId }, select: { isOpen: true } });
      if (!shift) return res.status(404).json({ error: "Shift not found" });
      if (!shift.isOpen) return res.status(400).json({ error: "Cannot pause selling on a closed shift" });
    }

    // Scope validation per engine.
    let scopeCeiling = Number.POSITIVE_INFINITY; // plates this scope itself can hold
    if (sellingMode !== SellingMode.KEYED) {
      if (!cookingRecordId) return res.status(400).json({ error: "cookingRecordId is required for this selling mode" });
      const batch = await prisma.cookingRecord.findUnique({
        where: { id: cookingRecordId },
        select: {
          id: true,
          stockSupplyId: true,
          sellingMode: true,
          disposed: true,
          platesActual: true,
          platesExpected: true,
          wastedPlates: true,
          platesPreSystemSold: true,
          cookingRecordMenus: { where: { menuId }, select: { platesRemaining: true } },
        },
      });
      if (!batch) return res.status(404).json({ error: "Cooking record not found" });
      if (batch.disposed) return res.status(400).json({ error: "Cannot pause a disposed batch" });
      if (batch.sellingMode !== sellingMode) {
        return res.status(400).json({ error: `Batch is not ${sellingMode}` });
      }
      if (sellingMode === SellingMode.ALLOCATED) {
        const split = batch.cookingRecordMenus[0];
        if (!split) return res.status(400).json({ error: "Menu item has no split on this batch" });
        scopeCeiling = round2(Number(split.platesRemaining));
      } else {
        const produced = round2(Number(batch.platesActual ?? batch.platesExpected ?? 0));
        const consumed = round2(Number(batch.wastedPlates) + Number(batch.platesPreSystemSold));
        const link = await prisma.orderItemAllocation.aggregate({
          where: { cookingRecordId: batch.id },
          _sum: { plates: true },
        });
        const sold = round2(Number(link._sum?.plates ?? 0));
        scopeCeiling = round2(Math.max(0, produced - consumed - sold));
        const linked = await prisma.stockSupplyMenu.findFirst({
          where: { menuId, stockSupplyId: batch.stockSupplyId, excludedFromSharedPool: false },
          select: { menuId: true },
        });
        if (!linked) return res.status(400).json({ error: "Menu item is not fed by this batch's supply" });
      }
    } else if (cookingRecordId) {
      return res.status(400).json({ error: "KEYED pauses cannot cite a cooking record" });
    }

    const opDay = operationDay ? dateOnly(new Date(operationDay)) : dateOnly(new Date());

    // Upsert the one active pause for this scope.
    const existing = await prisma.sellingPause.findFirst({
      where: {
        menuId,
        sellingMode,
        active: true,
        cookingRecordId: cookingRecordId ?? null,
        ...(shiftId ? { shiftId } : { shiftId: null }),
        operationDay: opDay,
      },
    });

    // Availability is what the pool can still serve AFTER every active pause —
    // so when raising an existing pause, hand its own withheld plates back
    // before comparing. The scope ceiling (split/batch remainder) bounds the
    // same way.
    const available = await sellableForMenu(prisma, menuId);
    const own = existing?.active ? round2(Number(existing.pausedPlates)) : 0;
    if (pp > available + own + 1e-9) {
      return res.status(400).json({ error: `Cannot pause more than available now (${round2(available)})` });
    }
    if (pp > scopeCeiling + own + 1e-9) {
      return res.status(400).json({ error: `Cannot pause more than this ${sellingMode === SellingMode.ALLOCATED ? "split" : "batch"} holds (${round2(scopeCeiling)})` });
    }

    if (existing) {
      const updated = await prisma.sellingPause.update({
        where: { id: existing.id },
        data: { pausedPlates: pp, reason: reason ?? null, active: true, pausedById: controller.id },
      });
      return res.json(updated);
    }
    const created = await prisma.sellingPause.create({
      data: {
        menuId,
        cookingRecordId: cookingRecordId ?? null,
        sellingMode,
        pausedPlates: pp,
        shiftId: shiftId ?? null,
        operationDay: opDay,
        reason: reason ?? null,
        pausedById: controller.id,
        active: true,
      },
    });
    res.status(201).json(created);
  } catch (e) {
    console.error("Error creating selling pause:", e);
    res.status(500).json({ error: "Failed to create selling pause" });
  }
});

/** PUT /:id — adjust the held amount, edit the reason, or resume (active=false). */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { pausedById, pausedPlates, active, reason } = req.body ?? {};
    const controller = await requireController(pausedById);
    if (!controller) return res.status(403).json({ error: "Only admin or manager can control selling" });

    const existing = await prisma.sellingPause.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Pause not found" });

    const data: { pausedPlates?: number; active?: boolean; reason?: string | null; pausedById?: string } = {};
    if (reason !== undefined) data.reason = reason ?? null;
    if (active !== undefined) data.active = Boolean(active);

    if (pausedPlates !== undefined) {
      const pp = round2(Number(pausedPlates));
      if (!Number.isFinite(pp) || pp < 0) return res.status(400).json({ error: "Invalid pausedPlates" });
      if (data.active !== false && pp <= 0) {
        return res.status(400).json({ error: "pausedPlates must be greater than 0 while the pause is active" });
      }
      // Re-arming or raising an active pause re-checks availability; its own
      // current withholding is credited back first.
      const available = await sellableForMenu(prisma, existing.menuId);
      const own = existing.active ? round2(Number(existing.pausedPlates)) : 0;
      if (pp > available + own + 1e-9) {
        return res.status(400).json({ error: `Cannot pause more than available now (${round2(available)})` });
      }
      data.pausedPlates = pp;
    } else if (data.active === true && !existing.active) {
      // Re-activating with the old amount still needs the plates to exist.
      const available = await sellableForMenu(prisma, existing.menuId);
      const pp = round2(Number(existing.pausedPlates));
      if (pp > available + 1e-9) {
        return res.status(400).json({ error: `Cannot pause more than available now (${round2(available)})` });
      }
    }

    data.pausedById = controller.id;
    const updated = await prisma.sellingPause.update({ where: { id }, data });
    res.json(updated);
  } catch (e) {
    console.error("Error updating selling pause:", e);
    res.status(500).json({ error: "Failed to update selling pause" });
  }
});

/** DELETE /:id — hard remove (resume via PUT active=false is preferred). */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { pausedById } = req.body ?? {};
    const controller = await requireController(pausedById);
    if (!controller) return res.status(403).json({ error: "Only admin or manager can control selling" });
    const existing = await prisma.sellingPause.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return res.status(404).json({ error: "Pause not found" });
    await prisma.sellingPause.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    console.error("Error deleting selling pause:", e);
    res.status(500).json({ error: "Failed to delete selling pause" });
  }
});

export default router;
