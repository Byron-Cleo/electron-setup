import { Router } from "express";
import prisma from "../db/db";

const router = Router();

// GET /api/reports/daily?date=YYYY-MM-DD
router.get("/", async (req, res) => {
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ error: "date query parameter is required (YYYY-MM-DD)" });
  }

  const targetDate = new Date(date as string);
  if (isNaN(targetDate.getTime())) {
    return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
  }

  // Start and end of day
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  // Get all cooking records for the day
  const cookingRecords = await prisma.cookingRecord.findMany({
    where: { cookedDate: targetDate },
    include: {
      stockSupply: { select: { id: true, name: true, unit: true, platesPerUnit: true } },
      assignments: {
        include: {
          menu: { select: { id: true, name: true } },
        },
      },
    },
  });

  // Get all fulfilled items for the day (what was delivered to kitchen)
  const fulfilledItems = await prisma.stockFulfillmentItem.findMany({
    where: {
      stockFulfillment: { createdAt: { gte: startOfDay, lte: endOfDay } },
    },
    include: {
      stockRequestItem: { select: { stockSupplyId: true } },
    },
  });

  // Aggregate by stock supply: ordered (fulfilled) vs cooked
  const stockSupplyMap = new Map<
    string,
    { name: string; ordered: number; cooked: number; platesProduced: number; platesSold: number }
  >();

  // Process fulfilled items (ordered)
  for (const item of fulfilledItems) {
    const stockSupplyId = item.stockRequestItem.stockSupplyId;
    const qty = Number(item.quantityDelivered);
    const existing = stockSupplyMap.get(stockSupplyId);
    if (existing) {
      existing.ordered += qty;
    } else {
      stockSupplyMap.set(stockSupplyId, {
        name: "",
        ordered: qty,
        cooked: 0,
        platesProduced: 0,
        platesSold: 0,
      });
    }
  }

  // Process cooking records (cooked + plates)
  for (const record of cookingRecords) {
    const stockSupplyId = record.stockSupplyId;
    const qty = Number(record.quantityCooked);
    const plates = Number(record.platesActual ?? record.platesExpected);
    const totalAssigned = record.assignments.reduce(
      (sum, a) => sum + Number(a.quantityPlates),
      0
    );

    const existing = stockSupplyMap.get(stockSupplyId);
    if (existing) {
      existing.cooked += qty;
      existing.platesProduced += plates;
      existing.platesSold += totalAssigned;
      existing.name = record.stockSupply.name;
    } else {
      stockSupplyMap.set(stockSupplyId, {
        name: record.stockSupply.name,
        ordered: 0,
        cooked: qty,
        platesProduced: plates,
        platesSold: totalAssigned,
      });
    }
  }

  // Build byStockItem
  const byStockItem = Array.from(stockSupplyMap.entries()).map(([id, data]) => ({
    id,
    name: data.name,
    ordered: data.ordered,
    cooked: data.cooked,
    rawRemaining: data.ordered - data.cooked,
    platesProduced: data.platesProduced,
    platesSold: data.platesSold,
    platesRemaining: data.platesProduced - data.platesSold,
  }));

  // Aggregate by menu variant
  const menuVariantMap = new Map<string, { name: string; platesProduced: number; platesSold: number }>();

  for (const record of cookingRecords) {
    for (const assignment of record.assignments) {
      const menuId = assignment.menuId;
      const qtyAssigned = Number(assignment.quantityPlates);
      const existing = menuVariantMap.get(menuId);
      if (existing) {
        existing.platesSold += qtyAssigned;
      } else {
        menuVariantMap.set(menuId, {
          name: assignment.menu.name,
          platesProduced: 0,
          platesSold: qtyAssigned,
        });
      }
    }
  }

  // Calculate plates produced per menu variant based on proportional assignment
  for (const record of cookingRecords) {
    const totalAssigned = record.assignments.reduce(
      (sum, a) => sum + Number(a.quantityPlates),
      0
    );
    if (totalAssigned === 0) continue;

    const platesActual = Number(record.platesActual ?? record.platesExpected);
    for (const assignment of record.assignments) {
      const proportion = Number(assignment.quantityPlates) / totalAssigned;
      const platesForVariant = platesActual * proportion;
      const existing = menuVariantMap.get(assignment.menuId);
      if (existing) {
        existing.platesProduced += platesForVariant;
      }
    }
  }

  const byMenuVariant = Array.from(menuVariantMap.values()).map((data) => ({
    name: data.name,
    platesProduced: Math.round(data.platesProduced),
    platesSold: data.platesSold,
    platesRemaining: Math.round(data.platesProduced) - data.platesSold,
  }));

  // Summary
  const totalCooked = byStockItem.reduce((sum, item) => sum + item.cooked, 0);
  const totalPlatesProduced = byStockItem.reduce((sum, item) => sum + item.platesProduced, 0);
  const totalPlatesSold = byStockItem.reduce((sum, item) => sum + item.platesSold, 0);
  const totalPlatesRemaining = totalPlatesProduced - totalPlatesSold;

  // Carry over to tomorrow
  const yesterday = new Date(targetDate);
  yesterday.setDate(yesterday.getDate() - 1);

  // Raw stock carry over: ordered - cooked for all days up to yesterday
  const allPreviousRecords = await prisma.cookingRecord.findMany({
    where: { cookedDate: { lt: targetDate } },
    include: {
      stockSupply: { select: { id: true, name: true } },
      assignments: {
        include: {
          menu: { select: { id: true, name: true } },
        },
      },
    },
  });

  const allPreviousFulfilled = await prisma.stockFulfillmentItem.findMany({
    where: {
      stockFulfillment: { createdAt: { lt: startOfDay } },
    },
    include: {
      stockRequestItem: { select: { stockSupplyId: true } },
    },
  });

  // Calculate carry over raw stock
  const carryOverRawMap = new Map<string, { name: string; ordered: number; cooked: number }>();
  for (const item of allPreviousFulfilled) {
    const stockSupplyId = item.stockRequestItem.stockSupplyId;
    const qty = Number(item.quantityDelivered);
    const existing = carryOverRawMap.get(stockSupplyId);
    if (existing) {
      existing.ordered += qty;
    } else {
      carryOverRawMap.set(stockSupplyId, { name: "", ordered: qty, cooked: 0 });
    }
  }
  for (const record of allPreviousRecords) {
    const stockSupplyId = record.stockSupplyId;
    const qty = Number(record.quantityCooked);
    const existing = carryOverRawMap.get(stockSupplyId);
    if (existing) {
      existing.cooked += qty;
      existing.name = record.stockSupply.name;
    } else {
      carryOverRawMap.set(stockSupplyId, { name: record.stockSupply.name, ordered: 0, cooked: qty });
    }
  }

  const carryOverRawStock = Array.from(carryOverRawMap.entries())
    .map(([id, data]) => ({
      id,
      name: data.name,
      quantity: data.ordered - data.cooked,
    }))
    .filter((item) => item.quantity > 0);

  // Calculate carry over cooked plates
  const carryOverPlatesMap = new Map<string, { name: string; produced: number; sold: number }>();
  for (const record of allPreviousRecords) {
    const plates = Number(record.platesActual ?? record.platesExpected);

    for (const assignment of record.assignments) {
      const menuId = assignment.menuId;
      const qtyAssigned = Number(assignment.quantityPlates);
      const existing = carryOverPlatesMap.get(menuId);
      if (existing) {
        existing.sold += qtyAssigned;
      } else {
        carryOverPlatesMap.set(menuId, {
          name: assignment.menu.name,
          produced: 0,
          sold: qtyAssigned,
        });
      }
    }

    // Add proportional plates produced
    const totalAssignedForRecord = record.assignments.reduce(
      (sum, a) => sum + Number(a.quantityPlates),
      0
    );
    if (totalAssignedForRecord > 0) {
      for (const assignment of record.assignments) {
        const proportion = Number(assignment.quantityPlates) / totalAssignedForRecord;
        const platesForVariant = plates * proportion;
        const existing = carryOverPlatesMap.get(assignment.menuId);
        if (existing) {
          existing.produced += platesForVariant;
        }
      }
    }
  }

  const carryOverCookedPlates = Array.from(carryOverPlatesMap.values())
    .map((data) => ({
      name: data.name,
      plates: Math.round(data.produced) - data.sold,
    }))
    .filter((item) => item.plates > 0);

  res.json({
    date: date as string,
    summary: {
      totalCooked,
      totalPlatesProduced: Math.round(totalPlatesProduced),
      totalPlatesSold,
      totalPlatesRemaining: Math.round(totalPlatesRemaining),
    },
    byStockItem,
    byMenuVariant,
    carryOverToTomorrow: {
      rawStock: carryOverRawStock,
      cookedPlates: carryOverCookedPlates,
    },
  });
});

export default router;
