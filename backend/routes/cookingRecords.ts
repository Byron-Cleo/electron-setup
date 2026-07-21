import { Router } from "express";
import prisma from "../db/db";

const router = Router();

// GET /api/cooking-records - List cooking records (optional ?date=YYYY-MM-DD, ?stockSupplyId filter)
router.get("/", async (req, res) => {
  const { stockSupplyId, date } = req.query;
  const where: Record<string, unknown> = {};
  if (stockSupplyId) {
    where.stockSupplyId = stockSupplyId;
  }
  if (date) {
    const d = new Date(date as string);
    if (isNaN(d.getTime())) {
      return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
    }
    where.cookedDate = d;
  }

  const records = await prisma.cookingRecord.findMany({
    where,
    include: {
      stockSupply: { select: { id: true, name: true, unit: true, platesPerUnit: true, menuId: true } },
      cookedBy: { select: { id: true, name: true } },
      assignments: {
        include: {
          menu: { select: { id: true, name: true, slug: true, images: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(records);
});

// POST /api/cooking-records - Create cooking record
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

  // Verify stock supply exists and has platesPerUnit configured
  const stockSupply = await prisma.stockSupply.findUnique({
    where: { id: stockSupplyId },
    include: { menu: { select: { id: true, stock: true } } },
  });
  if (!stockSupply) return res.status(404).json({ error: "Stock supply not found" });

  if (!stockSupply.platesPerUnit || Number(stockSupply.platesPerUnit) <= 0) {
    return res.status(400).json({ error: "platesPerUnit must be configured to cook this item" });
  }

  // Verify cook exists
  const cook = await prisma.user.findUnique({ where: { id: cookedById } });
  if (!cook) return res.status(400).json({ error: "Cook not found" });

  // Calculate kitchen inventory: total received (fulfilled) - total already cooked
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

  const platesExpected = qtyToCook * Number(stockSupply.platesPerUnit);

  const result = await prisma.$transaction(async (tx) => {
    const record = await tx.cookingRecord.create({
      data: {
        stockSupplyId,
        quantityCooked: qtyToCook,
        platesExpected,
        platesActual: platesActual ? Number(platesActual) : null,
        cookedById,
        notes,
      },
      include: {
        stockSupply: { select: { id: true, name: true, unit: true, platesPerUnit: true, menuId: true } },
        cookedBy: { select: { id: true, name: true } },
        assignments: {
          include: {
            menu: { select: { id: true, name: true, slug: true, images: true } },
          },
        },
      },
    });

    // Auto-update menu stock if menuId is set
    if (stockSupply.menuId && stockSupply.menu) {
      await tx.menu.update({
        where: { id: stockSupply.menuId },
        data: { stock: { increment: Math.round(platesExpected) } },
      });
    }

    return record;
  });

  res.status(201).json(result);
});

// PUT /api/cooking-records/:id - Update cooking record
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { platesActual, notes } = req.body;

  const existing = await prisma.cookingRecord.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Cooking record not found" });

  if (platesActual !== undefined && platesActual !== null && Number(platesActual) <= 0) {
    return res.status(400).json({ error: "platesActual must be greater than 0" });
  }

  const record = await prisma.cookingRecord.update({
    where: { id },
    data: {
      platesActual: platesActual !== undefined ? Number(platesActual) : existing.platesActual,
      notes: notes !== undefined ? notes : existing.notes,
    },
    include: {
      stockSupply: { select: { id: true, name: true, unit: true, platesPerUnit: true, menuId: true } },
      cookedBy: { select: { id: true, name: true } },
      assignments: {
        include: {
          menu: { select: { id: true, name: true, slug: true, images: true } },
        },
      },
    },
  });

  res.json(record);
});

// DELETE /api/cooking-records/:id - Delete cooking record (reverse menu stock)
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  const record = await prisma.cookingRecord.findUnique({
    where: { id },
    include: { stockSupply: { select: { id: true, menuId: true } } },
  });
  if (!record) return res.status(404).json({ error: "Cooking record not found" });

  await prisma.$transaction(async (tx) => {
    // Reverse menu stock if menuId was set
    if (record.stockSupply.menuId) {
      await tx.menu.update({
        where: { id: record.stockSupply.menuId },
        data: { stock: { decrement: Math.round(Number(record.platesExpected)) } },
      });
    }

    await tx.cookingRecord.delete({ where: { id } });
  });

  res.json({ message: "Cooking record deleted" });
});

export default router;
