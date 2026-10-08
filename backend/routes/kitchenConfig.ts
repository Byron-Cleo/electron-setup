import { Router } from "express";
import prisma from "../db/db.js";
import { Prisma } from "../db/generated/prisma/client.js";
import { emitLiveEvent } from "../events.js";

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
  const { menus, ...rest } = supply;
  return {
    ...rest,
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

    if (sellingMode !== undefined && sellingMode !== null && sellingMode !== "ALLOCATED" && sellingMode !== "SHARED") {
      return res.status(400).json({ error: "sellingMode must be ALLOCATED or SHARED" });
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
    res.json(updated);
  } catch (e: unknown) {
    const err = e as { code?: string; statusCode?: number; message?: string };
    if (err?.code === "P2025") return res.status(404).json({ error: "Stock supply not found" });
    if (err?.statusCode === 400) return res.status(400).json({ error: err.message });
    console.error("Error updating kitchen config:", e);
    res.status(500).json({ error: "Failed to update kitchen config" });
  }
});

export default router;