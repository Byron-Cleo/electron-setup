import { Router } from "express";
import prisma from "../db/db.js";

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

// GET /api/reports/shift/:id - Full shift report
router.get("/shift/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const shift = await prisma.shift.findUnique({
      where: { id },
      include: {
        openedBy: { select: { id: true, name: true } },
        closedBy: { select: { id: true, name: true } },
        snapshots: { include: { menu: { select: { id: true, name: true, price: true } } } },
        orders: {
          include: {
            OrderItem: true,
            User: { select: { name: true } },
          },
        },
      },
    });

    if (!shift) {
      return res.status(404).json({ error: "Shift not found" });
    }

    // Revenue is computed from non-void orders only
    const activeOrders = shift.orders.filter((o) => !o.isVoid);

    // Calculate revenue breakdown by meal period
    const revenueByMealType: Record<string, { orders: number; total: number }> = {};

    for (const order of activeOrders) {
      const mealType = order.mealType;
      if (!revenueByMealType[mealType]) {
        revenueByMealType[mealType] = { orders: 0, total: 0 };
      }
      revenueByMealType[mealType].orders += 1;
      revenueByMealType[mealType].total += Number(order.totalPrice);
    }

    // Calculate production cost
    const totalSales = activeOrders.reduce((sum, order) => sum + Number(order.totalPrice), 0);

    // Get cooking records during shift period (used for both cost and plate movement)
    const cookingRecords = await prisma.cookingRecord.findMany({
      where: {
        cookedDate: shift.date,
        createdAt: {
          gte: shift.openingTime,
          lte: shift.actualCloseTime ?? shift.autoCloseTime,
        },
      },
      include: {
        stockSupply: { select: { costPrice: true } },
        assignments: { select: { menuId: true, quantityPlates: true } },
      },
    });

    const totalProductionCost = cookingRecords.reduce((sum, record) => {
      const costPrice = Number(record.stockSupply.costPrice ?? 0);
      const quantityCooked = Number(record.quantityCooked);
      return sum + costPrice * quantityCooked;
    }, 0);

    // Aggregate plates cooked per menu item from cooking record assignments
    const platesCookedByMenu = new Map<string, number>();
    for (const record of cookingRecords) {
      for (const assignment of record.assignments) {
        const prev = platesCookedByMenu.get(assignment.menuId) ?? 0;
        platesCookedByMenu.set(assignment.menuId, prev + Number(assignment.quantityPlates));
      }
    }

    // Calculate plate movement — only items that were cooked or sold
    const plateMovement = shift.snapshots
      .map((snapshot) => {
        const platesCooked = platesCookedByMenu.get(snapshot.menuId) ?? 0;
        const expectedClosing = snapshot.openingPlates + platesCooked - snapshot.platesSold;
        const variance = (snapshot.closingPlates ?? expectedClosing) - expectedClosing;

        return {
          menuId: snapshot.menuId,
          menuName: snapshot.menu.name,
          openingPlates: snapshot.openingPlates,
          platesCooked,
          platesSold: snapshot.platesSold,
          closingPlates: snapshot.closingPlates,
          expectedClosing,
          variance,
        };
      })
      .filter((row) => row.platesSold > 0 || row.platesCooked > 0);

    // Calculate drift
    const driftMinutes = shift.actualCloseTime
      ? Math.round((shift.actualCloseTime.getTime() - shift.autoCloseTime.getTime()) / 60000)
      : 0;

    res.json({
      shift: {
        id: shift.id,
        type: shift.type,
        date: shift.date,
        openingTime: shift.openingTime,
        autoCloseTime: shift.autoCloseTime,
        actualCloseTime: shift.actualCloseTime,
        driftMinutes,
        isOpen: shift.isOpen,
        openedBy: shift.openedBy,
        closedBy: shift.closedBy,
      },
      plateMovement,
      revenue: {
        ...revenueByMealType,
        total: totalSales,
      },
      production: {
        totalCost: totalProductionCost,
        totalSales,
        variance: totalSales - totalProductionCost,
        profitMargin: totalSales > 0 ? `${((totalSales - totalProductionCost) / totalSales * 100).toFixed(1)}%` : "0%",
      },
      summary: {
        totalOrders: shift.orders.length,
        voidedOrders: shift.orders.filter((o) => o.isVoid).length,
      },
    });
  } catch (e) {
    console.error("Error getting shift report:", e);
    res.status(500).json({ error: "Failed to get shift report" });
  }
});

// GET /api/reports/voids?date=YYYY-MM-DD - Void summary by waiter
router.get("/voids", async (req, res) => {
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ error: "date query parameter is required (YYYY-MM-DD)" });
  }

  const targetDate = new Date(date as string);
  if (isNaN(targetDate.getTime())) {
    return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
  }

  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  try {
    // Get all orders for the day
    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
      include: {
        User: { select: { id: true, name: true } },
      },
    });

    // Reconciled voids = a replacement order exists whose voidedOrderId points
    // at them (searched by link, so replacements placed after midnight still count)
    const voidedIds = orders.filter((o) => o.isVoid).map((o) => o.id);
    const replacements =
      voidedIds.length > 0
        ? await prisma.order.findMany({
            where: { voidedOrderId: { in: voidedIds } },
            select: { id: true, voidedOrderId: true },
          })
        : [];
    const replacedVoidIds = new Set(replacements.map((r) => r.voidedOrderId as string));

    // Aggregate by waiter
    const waiterStats = new Map<string, { name: string; totalOrders: number; voidedOrders: number; replacedVoids: number; voidReasons: string[] }>();

    for (const order of orders) {
      const waiterId = order.userId;
      const existing = waiterStats.get(waiterId);

      if (existing) {
        existing.totalOrders += 1;
        if (order.isVoid) {
          existing.voidedOrders += 1;
          if (replacedVoidIds.has(order.id)) {
            existing.replacedVoids += 1;
          }
          if (order.voidReason && !existing.voidReasons.includes(order.voidReason)) {
            existing.voidReasons.push(order.voidReason);
          }
        }
      } else {
        waiterStats.set(waiterId, {
          name: order.User?.name ?? "Unknown",
          totalOrders: 1,
          voidedOrders: order.isVoid ? 1 : 0,
          replacedVoids: order.isVoid && replacedVoidIds.has(order.id) ? 1 : 0,
          voidReasons: order.voidReason ? [order.voidReason] : [],
        });
      }
    }

    const waiters = Array.from(waiterStats.entries()).map(([id, stats]) => ({
      waiterId: id,
      name: stats.name,
      totalOrders: stats.totalOrders,
      voidedOrders: stats.voidedOrders,
      replacedVoids: stats.replacedVoids,
      pendingVoids: stats.voidedOrders - stats.replacedVoids,
      voidRate: stats.totalOrders > 0 ? `${((stats.voidedOrders / stats.totalOrders) * 100).toFixed(1)}%` : "0%",
      commonReasons: stats.voidReasons,
    }));

    res.json({ date: targetDate, waiters });
  } catch (e) {
    console.error("Error getting void report:", e);
    res.status(500).json({ error: "Failed to get void report" });
  }
});

export default router;
