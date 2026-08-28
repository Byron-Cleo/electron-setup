import { Router } from "express";
import prisma from "../db/db.js";

const router = Router();

// GET /api/cooking-records/underproduced-count - Count records where actual plates < expected
// platesActual being null means production was exactly as expected (no variance to report)
router.get("/underproduced-count", async (_req, res) => {
  try {
    const records = await prisma.cookingRecord.findMany({
      where: {
        platesActual: { not: null },
        platesExpected: { gt: 0 },
      },
      select: { id: true, platesExpected: true, platesActual: true },
    });

    const underproduced = records.filter(
      (r) => Number(r.platesActual) < Number(r.platesExpected)
    );

    res.json({ count: underproduced.length });
  } catch (e) {
    console.error("Error counting underproduced records:", e);
    res.status(500).json({ error: "Failed to count underproduced records" });
  }
});

// GET /api/cooking-records/carry-over - Raw stock carry over (PENDING COOK)
router.get("/carry-over", async (_req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get all fulfilled items before today
  const allFulfilled = await prisma.stockFulfillmentItem.findMany({
    where: {
      stockFulfillment: { createdAt: { lt: today } },
    },
    include: {
      stockRequestItem: { select: { stockSupplyId: true, stockSupply: { select: { name: true, platesPerUnit: true } } } },
    },
  });

  // Get all cooking records before today
  const allRecords = await prisma.cookingRecord.findMany({
    where: { cookedDate: { lt: today } },
    include: { stockSupply: { select: { id: true, name: true, platesPerUnit: true } } },
  });

  // Aggregate by stock supply
  const carryOverMap = new Map<string, { name: string; ordered: number; cooked: number }>();

  for (const item of allFulfilled) {
    const stockSupplyId = item.stockRequestItem.stockSupplyId;
    const qty = Number(item.quantityDelivered);
    const existing = carryOverMap.get(stockSupplyId);
    if (existing) {
      existing.ordered += qty;
    } else {
      carryOverMap.set(stockSupplyId, {
        name: item.stockRequestItem.stockSupply.name,
        ordered: qty,
        cooked: 0,
      });
    }
  }

  for (const record of allRecords) {
    const stockSupplyId = record.stockSupplyId;
    const qty = Number(record.quantityCooked);
    const existing = carryOverMap.get(stockSupplyId);
    if (existing) {
      existing.cooked += qty;
    } else {
      carryOverMap.set(stockSupplyId, {
        name: record.stockSupply.name,
        ordered: 0,
        cooked: qty,
      });
    }
  }

  const carryOver = Array.from(carryOverMap.entries())
    .map(([id, data]) => ({
      id,
      name: data.name,
      quantity: data.ordered - data.cooked,
    }))
    .filter((item) => item.quantity > 0);

  res.json(carryOver);
});

const RECORD_INCLUDE = {
  stockSupply: {
    select: {
      id: true,
      name: true,
      unit: true,
      platesPerUnit: true,
      menus: {
        include: { menu: { select: { id: true, name: true, slug: true, images: true } } },
      },
    },
  },
  cookedBy: { select: { id: true, name: true } },
  cookingRecordMenus: {
    include: { menu: { select: { id: true, name: true, slug: true, images: true } } },
    orderBy: { createdAt: "asc" },
  },
} as const;

// GET /api/cooking-records - List cooking records (optional ?stockSupplyId filter)
router.get("/", async (req, res) => {
  const { stockSupplyId } = req.query;
  const where: Record<string, unknown> = {};
  if (stockSupplyId) {
    where.stockSupplyId = stockSupplyId;
  }

  const records = await prisma.cookingRecord.findMany({
    where,
    include: RECORD_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  res.json(records);
});

// GET /api/cooking-records/:id - Single cooking record (batch) with its menu splits
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const record = await prisma.cookingRecord.findUnique({
    where: { id },
    include: RECORD_INCLUDE,
  });
  if (!record) return res.status(404).json({ error: "Cooking record not found" });
  res.json(record);
});

// POST /api/cooking-records - Create a cooking BATCH (feeds zero+ menu items via splits)
router.post("/", async (req, res) => {
  const { stockSupplyId, quantityCooked, platesActual, cookedById, notes } = req.body;

  if (!stockSupplyId || !quantityCooked || !cookedById) {
    return res.status(400).json({ error: "stockSupplyId, quantityCooked, and cookedById are required" });
  }

  if (Number(quantityCooked) <= 0) {
    return res.status(400).json({ error: "quantityCooked must be greater than 0" });
  }

  if (platesActual !== undefined && platesActual !== null && Number(platesActual) <= 0) {
    return res.status(400).json({ error: "platesActual must be greater than 0" });
  }

  // Verify stock supply exists and has isMenuStock = true
  const stockSupply = await prisma.stockSupply.findUnique({
    where: { id: stockSupplyId },
  });
  if (!stockSupply) return res.status(404).json({ error: "Stock supply not found" });

  if (!stockSupply.isMenuStock) {
    return res.status(400).json({ error: "This stock item is not configured for menu use" });
  }

  // Verify cook exists
  const cook = await prisma.user.findUnique({ where: { id: cookedById } });
  if (!cook) return res.status(400).json({ error: "Cook not found" });

  // Calculate kitchen inventory: total received (fulfilled) - total already cooked (per batch)
  const totalFulfilled = await prisma.stockFulfillmentItem.aggregate({
    _sum: { quantityDelivered: true },
    where: { stockRequestItem: { stockSupplyId } },
  });
  const totalAlreadyCooked = await prisma.cookingRecord.aggregate({
    _sum: { quantityCooked: true },
    where: { stockSupplyId },
  });

  const received = Number(totalFulfilled._sum.quantityDelivered ?? 0);
  const cooked = Number(totalAlreadyCooked._sum.quantityCooked ?? 0);
  const kitchenInventory = received - cooked;
  const qtyToCook = Number(quantityCooked);

  if (qtyToCook > kitchenInventory) {
    return res.status(400).json({
      error: `Cannot cook more than kitchen inventory. Available: ${kitchenInventory}, Requested: ${qtyToCook}`,
    });
  }

  const platesExpected = qtyToCook * Number(stockSupply.platesPerUnit ?? 0);

  // If platesActual not provided, assume production matched expected (variance = 0)
  const finalPlatesActual = platesActual !== undefined && platesActual !== null
    ? Number(platesActual)
    : platesExpected;

  const record = await prisma.cookingRecord.create({
    data: {
      stockSupplyId,
      quantityCooked: qtyToCook,
      platesExpected,
      platesActual: finalPlatesActual,
      cookedById,
      notes,
    },
    include: RECORD_INCLUDE,
  });

  res.status(201).json(record);
});

// Recompute Menu.stock for a menu = sum of that menu's split platesRemaining
async function recomputeMenuStock(menuId: string) {
  const agg = await prisma.cookingRecordMenu.aggregate({
    _sum: { platesRemaining: true },
    where: { menuId },
  });
  const total = Number(agg._sum.platesRemaining ?? 0);
  await prisma.menu.update({
    where: { id: menuId },
    data: { stock: total },
  });
  return total;
}

// POST /api/cooking-records/:id/allocate - Set the batch's per-menu plate splits
// body: { allocations: [{ menuId, plates }] }  — replaces the full set for the batch
router.post("/:id/allocate", async (req, res) => {
  const { id } = req.params;
  const { allocations } = req.body;

  if (!Array.isArray(allocations) || allocations.length === 0) {
    return res.status(400).json({ error: "allocations array is required" });
  }

  const record = await prisma.cookingRecord.findUnique({
    where: { id },
    include: { stockSupply: { include: { menus: { include: { menu: true } } } } },
  });
  if (!record) return res.status(404).json({ error: "Cooking record not found" });

  // Compute the batch's produced total (cap for allocations)
  const produced = Number(record.platesActual ?? record.platesExpected);
  const validMenus = new Set(record.stockSupply.menus.map((sm) => sm.menuId));
  const validMenuNames = new Map(record.stockSupply.menus.map((sm) => [sm.menuId, sm.menu.name]));

  let totalAllocated = 0;
  const parsed: { menuId: string; plates: number }[] = [];
  for (const a of allocations) {
    const menuId = String(a.menuId ?? "");
    const plates = Number(a.plates ?? 0);
    if (!validMenus.has(menuId)) {
      return res.status(400).json({ error: `Menu "${menuId}" is not produced by this stock item` });
    }
    if (!Number.isFinite(plates) || plates < 0) {
      return res.status(400).json({ error: "Allocated plates must be >= 0" });
    }
    parsed.push({ menuId, plates });
    totalAllocated += plates;
  }

  if (totalAllocated > produced) {
    return res.status(400).json({
      error: `Cannot allocate more plates than produced. Produced: ${produced}, Allocated: ${totalAllocated}`,
    });
  }

  await prisma.$transaction(async (tx) => {
    const newMenuIds = new Set(parsed.map((p) => p.menuId));

    // Remove splits for menus no longer in the allocation set
    const existingSplits = await tx.cookingRecordMenu.findMany({
      where: { cookingRecordId: id },
      select: { menuId: true },
    });
    const toDelete = existingSplits.filter((s) => !newMenuIds.has(s.menuId)).map((s) => s.menuId);
    for (const menuId of toDelete) {
      await tx.cookingRecordMenu.deleteMany({ where: { cookingRecordId: id, menuId } });
    }

    // Upsert each allocation (fresh allocation -> remaining = allocated)
    for (const p of parsed) {
      await tx.cookingRecordMenu.upsert({
        where: { cookingRecordId_menuId: { cookingRecordId: id, menuId: p.menuId } },
        create: { cookingRecordId: id, menuId: p.menuId, platesAllocated: p.plates, platesRemaining: p.plates },
        update: { platesAllocated: p.plates, platesRemaining: p.plates },
      });
    }
    return parsed;
  });

  // Recompute Menu.stock for all affected menus
  const stockUpdates: { menuId: string; menuName?: string; stock: number }[] = [];
  for (const p of parsed) {
    const stock = await recomputeMenuStock(p.menuId);
    stockUpdates.push({ menuId: p.menuId, menuName: validMenuNames.get(p.menuId), stock });
  }

  const updated = await prisma.cookingRecord.findUnique({ where: { id }, include: RECORD_INCLUDE });
  res.json({ record: updated, stockUpdates });
});

// POST /api/cooking-records/:id/menu/:menuId/top-up - Add plates to a menu's split
router.post("/:id/menu/:menuId/top-up", async (req, res) => {
  const { id, menuId } = req.params;
  const { quantityPlates } = req.body;

  if (!quantityPlates || Number(quantityPlates) <= 0) {
    return res.status(400).json({ error: "quantityPlates must be greater than 0" });
  }

  const existing = await prisma.cookingRecordMenu.findUnique({
    where: { cookingRecordId_menuId: { cookingRecordId: id, menuId } },
  });
  if (!existing) {
    return res.status(404).json({ error: "This batch has no allocation for the given menu" });
  }

  // Enforce cap: total allocated across the batch's splits must not exceed produced
  const record = await prisma.cookingRecord.findUnique({
    where: { id },
    include: { cookingRecordMenus: { select: { platesAllocated: true } } },
  });
  if (!record) return res.status(404).json({ error: "Cooking record not found" });

  const produced = Number(record.platesActual ?? record.platesExpected);
  const currentTotal = record.cookingRecordMenus.reduce((sum, s) => sum + Number(s.platesAllocated), 0);
  if (currentTotal + Number(quantityPlates) > produced) {
    return res.status(400).json({
      error: `Cannot top up beyond produced plates. Produced: ${produced}, Currently allocated: ${currentTotal}`,
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.cookingRecordMenu.update({
      where: { cookingRecordId_menuId: { cookingRecordId: id, menuId } },
      data: { platesAllocated: { increment: Number(quantityPlates) }, platesRemaining: { increment: Number(quantityPlates) } },
    });
  });

  const stock = await recomputeMenuStock(menuId);
  const updated = await prisma.cookingRecord.findUnique({ where: { id }, include: RECORD_INCLUDE });
  res.json({ record: updated, menuId, stock });
});

// PUT /api/cooking-records/:id - Update cooking record (batch-level only)
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { quantityCooked, platesActual, notes } = req.body;

  const existing = await prisma.cookingRecord.findUnique({
    where: { id },
    include: { stockSupply: { select: { platesPerUnit: true } } },
  });
  if (!existing) return res.status(404).json({ error: "Cooking record not found" });

  if (platesActual !== undefined && platesActual !== null && Number(platesActual) <= 0) {
    return res.status(400).json({ error: "platesActual must be greater than 0" });
  }

  const newQuantityCooked = quantityCooked !== undefined ? Number(quantityCooked) : Number(existing.quantityCooked);
  const platesExpected = newQuantityCooked * Number(existing.stockSupply.platesPerUnit ?? 0);

  const record = await prisma.cookingRecord.update({
    where: { id },
    data: {
      quantityCooked: newQuantityCooked,
      platesExpected,
      // If platesActual explicitly set to null/undefined, default to expected (variance = 0)
      // If explicitly provided, use that value
      platesActual: platesActual !== undefined && platesActual !== null
        ? Number(platesActual)
        : platesExpected,
      notes: notes !== undefined ? notes : existing.notes,
    },
    include: RECORD_INCLUDE,
  });

  res.json(record);
});

// DELETE /api/cooking-records/:id - Delete cooking record (batch + its splits)
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  const record = await prisma.cookingRecord.findUnique({
    where: { id },
    include: { cookingRecordMenus: { select: { menuId: true } } },
  });
  if (!record) return res.status(404).json({ error: "Cooking record not found" });

  await prisma.$transaction(async (tx) => {
    await tx.cookingRecord.delete({ where: { id } }); // cascades splits
  });

  // Recompute Menu.stock for all menus that had a split in this batch
  for (const split of record.cookingRecordMenus) {
    await recomputeMenuStock(split.menuId);
  }

  res.json({ message: "Cooking record deleted" });
});

export default router;
