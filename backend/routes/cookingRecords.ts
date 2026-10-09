import { Router } from "express";
import prisma from "../db/db.js";
import { recomputeMenuStock, round2, soldByMenuForBatches } from "../pools.js";
import { findShiftIdForTime } from "./shiftCarryOver.js";
import { emitLiveEvent } from "../events.js";

const router = Router();

/** Any change to a batch's produced/split/disposed plates moves sellable stock. */
function emitPoolUpdated() {
  emitLiveEvent({ type: "pool.updated", at: new Date().toISOString() });
}

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

  // Stock returned to the store stops counting as kitchen carry-over.
  const allReturns = await prisma.stockReturn.findMany({
    where: { createdAt: { lt: today } },
    select: { stockSupplyId: true, quantityReturned: true },
  });
  const returnsBySupply = new Map<string, number>();
  for (const ret of allReturns) {
    returnsBySupply.set(
      ret.stockSupplyId,
      (returnsBySupply.get(ret.stockSupplyId) ?? 0) + Number(ret.quantityReturned),
    );
  }

  const carryOver = Array.from(carryOverMap.entries())
    .map(([id, data]) => ({
      id,
      name: data.name,
      quantity: data.ordered - data.cooked - (returnsBySupply.get(id) ?? 0),
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
  shift: { select: { id: true, type: true, operationDay: true, autoOpenTime: true, autoCloseTime: true } },
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
    orderBy: { createdAt: "asc" },
  });
  res.json(records);
});

// GET /api/cooking-records/:id - Single cooking record (batch) with its menu splits
// Sold + opening for each linked menu come straight from the open shift's
// snapshots (authoritative DB rows) — consumers never derive them from
// availability buckets, which can silently drop menus.
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const record = await prisma.cookingRecord.findUnique({
    where: { id },
    include: RECORD_INCLUDE,
  });
  if (!record) return res.status(404).json({ error: "Cooking record not found" });

  // The shift window the modal uses to decide "carry-over vs cooked this
  // shift": the shift actually operating now (window contains the clock),
  // falling back to the batch's own shift, then the latest open shift.
  const now = new Date();
  const openShifts = await prisma.shift.findMany({
    where: { isOpen: true },
    orderBy: { autoOpenTime: "asc" },
    select: { id: true, type: true, autoOpenTime: true, autoCloseTime: true },
  });
  const currentShift =
    openShifts.find((s) => s.autoOpenTime <= now && now < s.autoCloseTime) ??
    (record.shift ? openShifts.find((s) => s.id === record.shift!.id) : undefined) ??
    openShifts[openShifts.length - 1] ??
    null;

  // Sold is BATCH-scoped: the assignment modal is about this batch alone, so it
  // must never read the shift's cross-batch snapshot totals. The allocation
  // ledger keyed by (cookingRecordId, orderItem.menuId) is the source of truth.
  // Batch-scoped sold per linked menu. Two sources, and we take the larger:
  //   • the allocation ledger (OrderItemAllocation bucketed by batch)
  //   • the split's own consumed delta (allocated − remaining), which is how
  //     sales were recorded before the ledger existed.
  // Using the max means a legacy batch's already-consumed plates are never
  // reported as 0 (which would resurrect them on the next reallocation).
  const batchSolds = await soldByMenuForBatches(prisma, [id]);
  const soldForBatch = batchSolds.get(id);
  const splitByMenu = new Map(
    record.cookingRecordMenus.map((s) => [
      s.menuId,
      { allocated: Number(s.platesAllocated), remaining: Number(s.platesRemaining) },
    ]),
  );
  const batchSoldByMenu: Record<string, number> = {};
  for (const sm of record.stockSupply.menus) {
    const menuId = sm.menu.id;
    const ledger = round2(soldForBatch?.get(menuId)?.sold ?? 0);
    const split = splitByMenu.get(menuId);
    const legacy = split ? Math.max(0, round2(split.allocated - split.remaining)) : 0;
    batchSoldByMenu[menuId] = round2(Math.max(ledger, legacy));
  }

  res.json({
    ...record,
    batchSoldByMenu,
    // The batch's OWN shift (where it was cooked) — the carry-over origin. The
    // spread above already carried it, but we re-attach it explicitly because
    // `shift` below is overwritten with the *currently operating* shift.
    cookedInShift: record.shift
      ? {
          id: record.shift.id,
          type: record.shift.type,
          autoOpenTime: record.shift.autoOpenTime,
          autoCloseTime: record.shift.autoCloseTime,
        }
      : null,
    shift: currentShift
      ? {
          id: currentShift.id,
          type: currentShift.type,
          autoOpenTime: currentShift.autoOpenTime,
          autoCloseTime: currentShift.autoCloseTime,
        }
      : null,
  });
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
    include: { menus: { select: { menuId: true } } },
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

  const shiftId = await findShiftIdForTime(new Date());

  if (!shiftId) {
    return res.status(400).json({
      error: "No active shift. Cooking must be recorded during a shift window.",
    });
  }

  // Calculate next batch number for this stock supply and shift
  const lastBatch = await prisma.cookingRecord.findFirst({
    where: { stockSupplyId, shiftId },
    orderBy: { batchNumber: 'desc' },
    select: { batchNumber: true },
  });
  const nextBatch = (lastBatch?.batchNumber ?? 0) + 1;

  const record = await prisma.cookingRecord.create({
    data: {
      stockSupplyId,
      quantityCooked: qtyToCook,
      platesExpected,
      platesActual: finalPlatesActual,
      cookedById,
      notes,
      shiftId,
      batchNumber: nextBatch,
      // Freeze the engine onto the batch. Changing a supply's mode later must
      // not retroactively reinterpret what an already-cooked tray meant, so the
      // batch carries its own copy rather than reading through to the supply.
      sellingMode: stockSupply.sellingMode,
    },
    include: RECORD_INCLUDE,
  });

  // A SHARED batch becomes sellable through every linked dish immediately, so
  // mirror the new pool onto each linked dish's stock. (ALLOCATED batches have
  // no splits yet, so this is a no-op for them.)
  for (const sm of stockSupply.menus) {
    await recomputeMenuStock(prisma, sm.menuId);
  }

  emitPoolUpdated();
  res.status(201).json(record);
});

// POST /api/cooking-records/:id/allocate - Set the batch's per-menu plate splits
// body: { allocations: [{ menuId, plates }] }  — replaces the full set for the batch
router.post("/:id/allocate", async (req, res) => {
  const { id } = req.params;
  const { allocations } = req.body;

  if (!Array.isArray(allocations)) {
    return res.status(400).json({ error: "allocations array is required" });
  }


  const record = await prisma.cookingRecord.findUnique({
    where: { id },
    include: { stockSupply: { include: { menus: { include: { menu: true } } } }, cookingRecordMenus: true },
  });
  if (!record) return res.status(404).json({ error: "Cooking record not found" });

  // A shared pool has no per-dish split by design: the whole tray sells through
  // every dish. Allocating it would invent splits that the pool maths never
  // reads back, silently stranding plates.
  if (record.sellingMode === "SHARED") {
    return res.status(400).json({
      error:
        "This batch is a shared pool, so it is sellable by every dish already and has no allocation step.",
      code: "SHARED_HAS_NO_ALLOCATION",
    });
  }

  // Enforce FIFO allocation: cannot allocate from newer batch while older batch has unallocated plates
  if (record.batchNumber) {
    const olderBatches = await prisma.cookingRecord.findMany({
      where: {
        stockSupplyId: record.stockSupplyId,
        shiftId: record.shiftId,
        batchNumber: { lt: record.batchNumber },
      },
      include: { cookingRecordMenus: true },
    });

    for (const batch of olderBatches) {
      // A SHARED batch has no allocation step (the whole tray is sellable by
      // every dish), and a disposed batch's plates are gone. Neither can hold
      // unallocated plates that must be assigned before this newer batch.
      if (batch.sellingMode === "SHARED" || batch.disposed) continue;

      const produced = Number(batch.platesActual ?? batch.platesExpected);
      const totalEverAllocated = batch.cookingRecordMenus.reduce(
        (sum, crm) => sum + Number(crm.platesAllocated),
        0,
      );
      if (produced > totalEverAllocated) {
        return res.status(400).json({
          error: `Cannot allocate from batch ${record.batchNumber} while batch ${batch.batchNumber} has unallocated plates`,
        });
      }
    }
  }

  // Compute the batch's produced total (cap for allocations)
  const produced = Number(record.platesActual ?? record.platesExpected);
  const validMenus = new Set(record.stockSupply.menus.map((sm) => sm.menuId));
  const validMenuNames = new Map(record.stockSupply.menus.map((sm) => [sm.menuId, sm.menu.name]));

  // Sold plates per dish for THIS batch, straight from the allocation ledger.
  // `plates` in the payload is the new ASSIGNED amount, so an allocation can
  // never drop below what has already sold (that would resurrect gone plates),
  // and a dish that sold from this batch cannot be dropped from the split set.
  const batchSolds = await soldByMenuForBatches(prisma, [id]);
  const soldForBatch = batchSolds.get(id);
  const splitByMenu = new Map(
    record.cookingRecordMenus.map((s) => [
      s.menuId,
      { allocated: Number(s.platesAllocated), remaining: Number(s.platesRemaining) },
    ]),
  );
  const soldForMenu = (menuId: string) => {
    const ledger = round2(soldForBatch?.get(menuId)?.sold ?? 0);
    const split = splitByMenu.get(menuId);
    const legacy = split ? Math.max(0, round2(split.allocated - split.remaining)) : 0;
    return round2(Math.max(ledger, legacy));
  };

  let totalAllocated = 0;
  const parsed: { menuId: string; plates: number; sold: number }[] = [];
  for (const a of allocations) {
    const menuId = String(a.menuId ?? "");
    const plates = Number(a.plates ?? 0);
    if (!validMenus.has(menuId)) {
      return res.status(400).json({ error: `Menu "${menuId}" is not produced by this stock item` });
    }
    if (!Number.isFinite(plates) || plates < 0) {
      return res.status(400).json({ error: "Allocated plates must be >= 0" });
    }
    const sold = soldForMenu(menuId);
    if (plates < sold) {
      return res.status(400).json({
        error: `${validMenuNames.get(menuId) ?? menuId} already sold ${sold} plate(s) from this batch; its allocation cannot go below that.`,
        code: "BELOW_SOLD",
      });
    }
    parsed.push({ menuId, plates, sold });
    totalAllocated += plates;
  }

  if (totalAllocated > produced) {
    return res.status(400).json({
      error: `Cannot allocate more plates than produced. Produced: ${produced}, Allocated: ${totalAllocated}`,
    });
  }

  const keepMenuIds = new Set(parsed.map((p) => p.menuId));
  for (const split of record.cookingRecordMenus) {
    if (!keepMenuIds.has(split.menuId) && soldForMenu(split.menuId) > 0) {
      return res.status(400).json({
        error: `${validMenuNames.get(split.menuId) ?? split.menuId} already sold from this batch; it cannot be removed from the allocation.`,
        code: "BELOW_SOLD",
      });
    }
  }

  const menuIdsToRecompute = new Set(parsed.map((p) => p.menuId));

  await prisma.$transaction(async (tx) => {
    const newMenuIds = new Set(parsed.map((p) => p.menuId));

    // Remove splits for menus no longer in the allocation set
    const existingSplits = await tx.cookingRecordMenu.findMany({
      where: { cookingRecordId: id },
      select: { menuId: true },
    });
    const toDelete = existingSplits.filter((s) => !newMenuIds.has(s.menuId)).map((s) => s.menuId);
    for (const menuId of toDelete) {
      menuIdsToRecompute.add(menuId);
      await tx.cookingRecordMenu.deleteMany({ where: { cookingRecordId: id, menuId } });
    }

    // Upsert each allocation. `plates` is the new ASSIGNED amount; remaining
    // keeps already-sold plates baked in, so reallocation never resurrects
    // stock that orders have consumed.
    for (const p of parsed) {
      const remaining = round2(p.plates - p.sold);
      await tx.cookingRecordMenu.upsert({
        where: { cookingRecordId_menuId: { cookingRecordId: id, menuId: p.menuId } },
        create: { cookingRecordId: id, menuId: p.menuId, platesAllocated: p.plates, platesRemaining: remaining },
        update: { platesAllocated: p.plates, platesRemaining: remaining },
      });
    }
    return parsed;
  });

  // Recompute Menu.stock for all affected menus — including any whose split was
  // dropped, so their availability reflects the removed plates.
  const stockUpdates: { menuId: string; menuName?: string; stock: number }[] = [];
  for (const menuId of menuIdsToRecompute) {
    const stock = await recomputeMenuStock(prisma, menuId);
    stockUpdates.push({ menuId, menuName: validMenuNames.get(menuId), stock });
  }

  const updated = await prisma.cookingRecord.findUnique({ where: { id }, include: RECORD_INCLUDE });
  emitPoolUpdated();
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

  const record = await prisma.cookingRecord.findUnique({
    where: { id },
    include: { cookingRecordMenus: { select: { platesAllocated: true } }, stockSupply: { select: { id: true } } },
  });
  if (!record) return res.status(404).json({ error: "Cooking record not found" });

  // Enforce FIFO allocation: cannot allocate from newer batch while older batch has unallocated plates
  const fullRecord = await prisma.cookingRecord.findUnique({
    where: { id },
    include: { cookingRecordMenus: true },
  });
  if (fullRecord?.batchNumber) {
    const olderBatches = await prisma.cookingRecord.findMany({
      where: {
        stockSupplyId: fullRecord.stockSupplyId,
        shiftId: fullRecord.shiftId,
        batchNumber: { lt: fullRecord.batchNumber },
      },
      include: { cookingRecordMenus: true },
    });

    for (const batch of olderBatches) {
      const produced = Number(batch.platesActual ?? batch.platesExpected);
      const totalEverAllocated = batch.cookingRecordMenus.reduce(
        (sum, crm) => sum + Number(crm.platesAllocated),
        0,
      );
      if (produced > totalEverAllocated) {
        return res.status(400).json({
          error: `Cannot allocate from batch ${fullRecord.batchNumber} while batch ${fullRecord.batchNumber} has unallocated plates`,
        });
      }
    }
  }

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

  const stock = await recomputeMenuStock(prisma, menuId);
  const updated = await prisma.cookingRecord.findUnique({ where: { id }, include: RECORD_INCLUDE });
  emitPoolUpdated();
  res.json({ record: updated, menuId, stock });
});

// PUT /api/cooking-records/:id - Update cooking record (batch-level only)
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { quantityCooked, platesActual, notes } = req.body;

  const existing = await prisma.cookingRecord.findUnique({
    where: { id },
    include: { stockSupply: { select: { platesPerUnit: true, menus: { select: { menuId: true } } } } },
  });
  if (!existing) return res.status(404).json({ error: "Cooking record not found" });

  // Reject attempts to set shiftId to null/falsy if provided
  if (req.body.shiftId !== undefined && !req.body.shiftId) {
    return res.status(400).json({ error: "shiftId cannot be null or empty" });
  }
  // Reject attempts to clear batchNumber if provided
  if (req.body.batchNumber !== undefined && (req.body.batchNumber === null || req.body.batchNumber === "")) {
    return res.status(400).json({ error: "batchNumber cannot be cleared" });
  }

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

  // Changing produced plates changes the pool, so every linked dish's mirrored
  // stock must be refreshed.
  for (const sm of existing.stockSupply.menus) {
    await recomputeMenuStock(prisma, sm.menuId);
  }

  emitPoolUpdated();
  res.json(record);
});

// POST /api/cooking-records/:id/dispose - Mark an unassigned (unallocated) batch as
// wasted. Only affects the batch's flags — unassigned plates never entered Menu.stock,
// so there is no stock to reconcile.
router.post("/:id/dispose", async (req, res) => {
  const { id } = req.params;

  const existing = await prisma.cookingRecord.findUnique({
    where: { id },
    select: {
      id: true,
      disposed: true,
      disposedAt: true,
      stockSupply: { select: { menus: { select: { menuId: true } } } },
    },
  });
  if (!existing) return res.status(404).json({ error: "Cooking record not found" });

  if (existing.disposed) {
    return res.json({ record: existing, message: "Already marked as wasted" });
  }

  const record = await prisma.cookingRecord.update({
    where: { id },
    data: { disposed: true, disposedAt: new Date() },
  });

  // Disposed batches drop out of every sellable pool, so each linked dish's
  // stock must be recomputed to shed the wasted plates.
  for (const sm of existing.stockSupply.menus) {
    await recomputeMenuStock(prisma, sm.menuId);
  }

  emitPoolUpdated();
  res.json({ record });
});

// DELETE /api/cooking-records/:id - Delete cooking record (batch + its splits)
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  const record = await prisma.cookingRecord.findUnique({
    where: { id },
    include: {
      cookingRecordMenus: { select: { menuId: true } },
      stockSupply: { select: { menus: { select: { menuId: true } } } },
    },
  });
  if (!record) return res.status(404).json({ error: "Cooking record not found" });

  await prisma.$transaction(async (tx) => {
    await tx.cookingRecord.delete({ where: { id } }); // cascades splits
  });

  // Recompute Menu.stock for every dish this batch could feed. A SHARED batch
  // has no splits, so relying on cookingRecordMenus alone would leave the pool
  // stranded in each linked dish's stock after deletion.
  const menuIds = new Set<string>([
    ...record.cookingRecordMenus.map((s) => s.menuId),
    ...record.stockSupply.menus.map((sm) => sm.menuId),
  ]);
  for (const menuId of menuIds) {
    await recomputeMenuStock(prisma, menuId);
  }

  emitPoolUpdated();
  res.json({ message: "Cooking record deleted" });
});

export default router;
