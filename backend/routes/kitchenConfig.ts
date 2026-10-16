import { Router } from "express";
import prisma from "../db/db.js";
import { Prisma } from "../db/generated/prisma/client.js";
import { emitLiveEvent } from "../events.js";
import { recomputeMenuStockWithSiblings } from "../pools.js";
import { resolveCurrentShift } from "./orders.js";

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SUPPLY_SELECT = {
  id: true,
  name: true,
  unit: true,
  image: true,
  currentStock: true,
  reorderLevel: true,
  isMenuStock: true,
  platesPerUnit: true,
  sellingMode: true,
  keyedStock: true,
  menus: {
    select: {
      platesPerServing: true,
      excludedFromSharedPool: true,
      menu: {
        select: {
          id: true,
          name: true,
          hasPortion: true,
          // Relation on Menu is named portionOptions; the API exposes it as
          // `portions`, so the renaming happens in the mapping below.
          portionOptions: {
            where: { category: "PORTION" },
            select: { id: true, name: true, price: true, platesPerServing: true },
            orderBy: { name: "asc" },
          },
        },
      },
    },
  },
} as const;

// Prisma returns Decimal columns as strings and names the Menu relation
// `portionOptions`, but the API contract (KitchenConfigItem in
// types/electron.d.ts) exposes it as `portions` with numeric fields. Normalize
// once here so the GET and PUT responses cannot drift apart.
type ConfigSupply = Prisma.StockSupplyGetPayload<{ select: typeof SUPPLY_SELECT }>;

function serializeConfigItem(supply: ConfigSupply) {
  const { menus, keyedStock, ...rest } = supply;
  return {
    ...rest,
    // Decimal serialises to a string over JSON; the UI wants a number.
    keyedStock: Number(keyedStock),
    // A dish fed by several supplies would need one factor per supply, so
    // surface them per link instead of collapsing to a menu id.
    menus: menus.map((link) => {
      const { portionOptions, ...menu } = link.menu;
      return {
        ...menu,
        platesPerServing: Number(link.platesPerServing),
        excludedFromSharedPool: link.excludedFromSharedPool,
        portions: portionOptions.map((p) => ({
          ...p,
          price: p.price == null ? p.price : Number(p.price),
          platesPerServing: Number(p.platesPerServing),
        })),
      };
    }),
  };
}

// GET /api/kitchen-config - List all stock supplies with kitchen config
router.get("/", async (_req, res) => {
  try {
    const items = await prisma.stockSupply.findMany({
      where: { isActive: true },
      select: SUPPLY_SELECT,
      orderBy: { name: "asc" },
    });
    res.json(items.map(serializeConfigItem));
  } catch (e) {
    console.error("Error listing kitchen config:", e);
    res.status(500).json({ error: "Failed to list kitchen config" });
  }
});

// PUT /api/kitchen-config/:id - Update plates per unit / engine / per-dish rates
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { platesPerUnit, sellingMode, menuFactors } = req.body;

  try {
    // A malformed :id reaches Postgres as "invalid input syntax for type uuid"
    // (P2007), which Prisma surfaces as a rejected promise. Lookups sit inside
    // the try so that 404s instead of escaping as an unhandled rejection.
    if (!UUID_RE.test(id)) {
      return res.status(404).json({ error: "Stock supply not found" });
    }

    const stockSupply = await prisma.stockSupply.findUnique({ where: { id } });
    if (!stockSupply) return res.status(404).json({ error: "Stock supply not found" });

    if (
      sellingMode !== undefined &&
      sellingMode !== null &&
      sellingMode !== "ALLOCATED" &&
      sellingMode !== "SHARED" &&
      sellingMode !== "KEYED"
    ) {
      return res.status(400).json({ error: "sellingMode must be ALLOCATED, SHARED or KEYED" });
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Per-dish consumption rates, e.g. Boiled Meat Half = 0.5 / Full = 1. A
      // dish can optionally be held back from a SHARED pool (excluded) so the
      // engine is not abandoned just to keep one dish off the shared tray.
      if (Array.isArray(menuFactors)) {
        for (const entry of menuFactors) {
          const factor = Number(entry?.platesPerServing);
          if (!entry?.menuId || !Number.isFinite(factor) || factor <= 0) {
            throw Object.assign(new Error("Each menuFactors entry needs a menuId and a positive platesPerServing"), {
              statusCode: 400,
            });
          }
          const excluded =
            entry.excludedFromSharedPool !== undefined && entry.excludedFromSharedPool !== null
              ? Boolean(entry.excludedFromSharedPool)
              : undefined;
          await tx.stockSupplyMenu.upsert({
            where: { stockSupplyId_menuId: { stockSupplyId: id, menuId: entry.menuId } },
            create: { stockSupplyId: id, menuId: entry.menuId, platesPerServing: factor, ...(excluded !== undefined && { excludedFromSharedPool: excluded }) },
            update: { platesPerServing: factor, ...(excluded !== undefined && { excludedFromSharedPool: excluded }) },
          });
        }
      }

      const supply = await tx.stockSupply.update({
        where: { id },
        data: {
          ...(platesPerUnit !== undefined && { platesPerUnit }),
          ...(sellingMode !== undefined && sellingMode !== null && { sellingMode }),
        },
        select: SUPPLY_SELECT,
      });

      return serializeConfigItem(supply);
    });

    // Selling engine / consumption-rate changes shift how the pool is read, so
    // tell live clients to re-pull their stock views.
    emitLiveEvent({ type: "pool.updated", at: new Date().toISOString() });

    // Flipping the engine changes how Menu.stock is *derived* (KEYED reads the
    // hand-keyed pool; ALLOCATED/SHARED read batches), so re-mirror every
    // linked dish — otherwise a newly-keyed dish would keep a stale figure.
    if (
      sellingMode !== undefined &&
      sellingMode !== null &&
      sellingMode !== stockSupply.sellingMode
    ) {
      for (const m of updated.menus) {
        await recomputeMenuStockWithSiblings(prisma, m.id);
      }
    }

    res.json(updated);
  } catch (e: unknown) {
    const err = e as { code?: string; statusCode?: number; message?: string };
    if (err?.code === "P2025") return res.status(404).json({ error: "Stock supply not found" });
    if (err?.statusCode === 400) return res.status(400).json({ error: err.message });
    console.error("Error updating kitchen config:", e);
    res.status(500).json({ error: "Failed to update kitchen config" });
  }
});

// POST /api/kitchen-config/:id/key - Set the hand-keyed amount on a KEYED supply
// body: { amount, reason?, userId? }
// The amount is the pool value *now*, not a cumulative top-up: it is set
// outright and the signed difference is written to the append-only
// StockAdjustment trail. A top-up while a shift is open stamps the linked
// dishes' snapshot as Received; a reduction shows as an Adjustment.
router.post("/:id/key", async (req, res) => {
  const { id } = req.params;
  const { amount, reason, userId } = req.body;

  try {
    if (!UUID_RE.test(id)) {
      return res.status(404).json({ error: "Stock supply not found" });
    }
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return res.status(400).json({ error: "amount must be a non-negative number" });
    }

    const supply = await prisma.stockSupply.findUnique({
      where: { id },
      include: { menus: { select: { menuId: true } } },
    });
    if (!supply) return res.status(404).json({ error: "Stock supply not found" });
    if (supply.sellingMode !== "KEYED") {
      return res.status(400).json({ error: "Only a keyed supply can be keyed", code: "NOT_KEYED" });
    }

    const amountBefore = Number(supply.keyedStock);
    const amountAfter = Math.round(parsed * 100) / 100;
    const delta = Math.round((amountAfter - amountBefore) * 100) / 100;

    // Retrieved outside the tx: a keyed top-up/reduction while the order-taking
    // shift is open is stock movement for that shift's report.
    const runningShift = delta !== 0 ? await resolveCurrentShift() : null;

    const adjustment = await prisma.$transaction(async (tx) => {
      await tx.stockSupply.update({ where: { id }, data: { keyedStock: amountAfter } });

      const row = await tx.stockAdjustment.create({
        data: {
          stockSupplyId: id,
          userId: userId && UUID_RE.test(userId) ? userId : null,
          action: delta >= 0 ? "KEY" : "ADJUST",
          delta,
          amountBefore,
          amountAfter,
          reason: typeof reason === "string" && reason.trim() ? reason.trim() : null,
        },
      });

      if (runningShift && delta !== 0) {
        for (const m of supply.menus) {
          const snapshot = await tx.shiftSnapshot.findUnique({
            where: { shiftId_menuId: { shiftId: runningShift.id, menuId: m.menuId } },
          });
          if (snapshot) {
            await tx.shiftSnapshot.update({
              where: { id: snapshot.id },
              data: { platesReceived: { increment: delta } },
            });
          }
        }
      }

      return row;
    });

    // Re-derive Menu.stock for every linked dish so the waiter grid reflects
    // the new keyed amount immediately.
    for (const m of supply.menus) {
      await recomputeMenuStockWithSiblings(prisma, m.menuId);
    }

    emitLiveEvent({ type: "pool.updated", at: new Date().toISOString() });
    res.status(201).json({
      id: adjustment.id,
      stockSupplyId: adjustment.stockSupplyId,
      action: adjustment.action,
      delta: Number(adjustment.delta),
      amountBefore: Number(adjustment.amountBefore),
      amountAfter: Number(adjustment.amountAfter),
      reason: adjustment.reason,
      createdAt: adjustment.createdAt,
    });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === "P2025") return res.status(404).json({ error: "Stock supply not found" });
    console.error("Error keying supply:", e);
    res.status(500).json({ error: "Failed to key supply" });
  }
});

// GET /api/kitchen-config/:id/adjustments - Recent key/adjust trail, newest first
router.get("/:id/adjustments", async (req, res) => {
  const { id } = req.params;
  try {
    if (!UUID_RE.test(id)) {
      return res.status(404).json({ error: "Stock supply not found" });
    }
    const rows = await prisma.stockAdjustment.findMany({
      where: { stockSupplyId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        action: true,
        delta: true,
        amountBefore: true,
        amountAfter: true,
        reason: true,
        createdAt: true,
        user: { select: { id: true, name: true } },
      },
    });
    res.json(
      rows.map((r) => ({
        id: r.id,
        action: r.action,
        delta: Number(r.delta),
        amountBefore: Number(r.amountBefore),
        amountAfter: Number(r.amountAfter),
        reason: r.reason,
        createdAt: r.createdAt,
        userId: r.user?.id ?? null,
        userName: r.user?.name ?? null,
      })),
    );
  } catch (e) {
    console.error("Error listing stock adjustments:", e);
    res.status(500).json({ error: "Failed to list stock adjustments" });
  }
});

export default router;