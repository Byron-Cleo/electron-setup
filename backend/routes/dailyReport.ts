import { Router } from "express";
import prisma from "../db/db.js";
import { computeShiftUnassignedBatches } from "./shiftCarryOver.js";

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
      cookingRecordMenus: {
        select: {
          menuId: true,
          platesAllocated: true,
          platesRemaining: true,
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
    const platesRemaining = record.cookingRecordMenus.reduce(
      (sum, crm) => sum + Number(crm.platesRemaining),
      0
    );
    const platesConsumed = Math.max(0, plates - platesRemaining);

    const existing = stockSupplyMap.get(stockSupplyId);
    if (existing) {
      existing.cooked += qty;
      existing.platesProduced += plates;
      existing.platesSold += platesConsumed;
      existing.name = record.stockSupply.name;
    } else {
      stockSupplyMap.set(stockSupplyId, {
        name: record.stockSupply.name,
        ordered: 0,
        cooked: qty,
        platesProduced: plates,
        platesSold: platesConsumed,
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

  // Aggregate by menu item (each split feeds exactly one menu)
  const menuVariantMap = new Map<string, { name: string; platesProduced: number; platesSold: number }>();

  for (const record of cookingRecords) {
    for (const crm of record.cookingRecordMenus) {
      const menuId = crm.menuId;
      const plates = Number(crm.platesAllocated);
      const platesRemaining = Number(crm.platesRemaining);
      const platesConsumed = Math.max(0, plates - platesRemaining);

      const existing = menuVariantMap.get(menuId);
      if (existing) {
        existing.platesProduced += plates;
        existing.platesSold += platesConsumed;
      } else {
        menuVariantMap.set(menuId, {
          name: crm.menu.name,
          platesProduced: plates,
          platesSold: platesConsumed,
        });
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
      cookingRecordMenus: {
        select: {
          menuId: true,
          platesRemaining: true,
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

  // Calculate carry over cooked plates per menu = live remaining on previous splits
  const carryOverPlatesMap = new Map<string, { name: string; plates: number }>();
  for (const record of allPreviousRecords) {
    for (const crm of record.cookingRecordMenus) {
      const platesCarried = Number(crm.platesRemaining);
      if (platesCarried <= 0) continue;
      const existing = carryOverPlatesMap.get(crm.menuId);
      if (existing) {
        existing.plates += platesCarried;
      } else {
        carryOverPlatesMap.set(crm.menuId, {
          name: crm.menu.name,
          plates: platesCarried,
        });
      }
    }
  }

  const carryOverCookedPlates = Array.from(carryOverPlatesMap.values())
    .map((data) => ({
      name: data.name,
      plates: Math.round(data.plates),
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
        finalClosedBy: { select: { id: true, name: true } },
        snapshots: { include: { menu: { select: { id: true, name: true, price: true, stock: true } } } },
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

    // Revenue is computed from paid non-void orders only. Unpaid (including
    // manager-marked-unpaid) orders stay in the total count but are excluded
    // from revenue and reported separately in the payment summary.
    const activeOrders = shift.orders.filter((o) => !o.isVoid);
    const paidOrders = activeOrders.filter((o) => o.isPaid);
    const unpaidOrders = activeOrders.filter((o) => !o.isPaid);

    // Calculate revenue breakdown by meal period
    const revenueByMealType: Record<string, { orders: number; total: number }> = {};

    for (const order of paidOrders) {
      const mealType = order.mealType;
      if (!revenueByMealType[mealType]) {
        revenueByMealType[mealType] = { orders: 0, total: 0 };
      }
      revenueByMealType[mealType].orders += 1;
      revenueByMealType[mealType].total += Number(order.totalPrice);
    }

    // Calculate production cost
    const totalSales = paidOrders.reduce((sum, order) => sum + Number(order.totalPrice), 0);

    // Payment summary: cash / mpesa collected per system, unpaid tracked amount,
    // manager-declared amounts and per-mode variance.
    const cashTotal = paidOrders
      .filter((o) => o.paymentMethod === "cash")
      .reduce((sum, o) => sum + Number(o.totalPrice), 0);
    const mpesaTotal = paidOrders
      .filter((o) => o.paymentMethod === "mpesa")
      .reduce((sum, o) => sum + Number(o.totalPrice), 0);
    const unpaidTotal = unpaidOrders.reduce((sum, o) => sum + Number(o.totalPrice), 0);
    const declaredCash = shift.declaredCash !== null && shift.declaredCash !== undefined
      ? Number(shift.declaredCash)
      : null;
    const declaredMpesa = shift.declaredMpesa !== null && shift.declaredMpesa !== undefined
      ? Number(shift.declaredMpesa)
      : null;
    const payments = {
      cashTotal,
      mpesaTotal,
      unpaid: {
        count: unpaidOrders.length,
        total: unpaidTotal,
      },
      declaredCash,
      declaredMpesa,
      cashVariance: declaredCash !== null ? declaredCash - cashTotal : null,
      mpesaVariance: declaredMpesa !== null ? declaredMpesa - mpesaTotal : null,
    };

    // Find the next shift's autoOpenTime to define the upper boundary of this shift's window
    const nextShift = await prisma.shift.findFirst({
      where: {
        autoOpenTime: { gt: shift.autoOpenTime },
        operationDay: shift.operationDay,
      },
      orderBy: { autoOpenTime: "asc" },
      select: { autoOpenTime: true },
    });

    const windowEnd = nextShift?.autoOpenTime ?? shift.autoCloseTime;

    // Core cooking records: within the shift's scheduled time window
    const cookingRecords = await prisma.cookingRecord.findMany({
      where: {
        createdAt: {
          gte: shift.autoOpenTime,
          lt: windowEnd,
        },
      },
      include: {
        stockSupply: { select: { costPrice: true } },
        cookingRecordMenus: { select: { menuId: true, platesAllocated: true } },
      },
    });

    const totalProductionCost = cookingRecords.reduce((sum, record) => {
      const costPrice = Number(record.stockSupply.costPrice ?? 0);
      const quantityCooked = Number(record.quantityCooked);
      return sum + costPrice * quantityCooked;
    }, 0);

    // Aggregate plates cooked per menu item from splits
    const platesCookedByMenu = new Map<string, number>();
    for (const record of cookingRecords) {
      for (const crm of record.cookingRecordMenus) {
        const plates = Number(crm.platesAllocated);
        platesCookedByMenu.set(crm.menuId, (platesCookedByMenu.get(crm.menuId) ?? 0) + plates);
      }
    }

    // Calculate plate movement — only items that were cooked or sold.
    // For an open shift (live or awaiting manual close) there is no final
    // closingPlates yet, so use the current live menu stock as the "Current"
    // value and flag it so the UI can label it accordingly.
    const isOpenShift = shift.isOpen;
    const plateMovement = shift.snapshots
      .map((snapshot) => {
        const platesCooked = platesCookedByMenu.get(snapshot.menuId) ?? 0;
        const expectedClosing = snapshot.openingPlates + platesCooked - snapshot.platesSold;
        const closingPlates = isOpenShift
          ? (snapshot.menu.stock ?? 0)
          : snapshot.closingPlates;
        const variance = (closingPlates ?? expectedClosing) - expectedClosing;
        const isLiveCurrent = isOpenShift;

        return {
          menuId: snapshot.menuId,
          menuName: snapshot.menu.name,
          openingPlates: snapshot.openingPlates,
          platesCooked,
          platesSold: snapshot.platesSold,
          closingPlates,
          isLiveCurrent,
          expectedClosing,
          variance,
        };
      })
      .filter((row) => row.platesSold > 0 || row.platesCooked > 0);

    // Calculate drift
    const driftMinutes = shift.autoClosedAt
      ? Math.round((shift.autoClosedAt.getTime() - shift.autoCloseTime.getTime()) / 60000)
      : 0;

    // Clocking drift (signed, early = negative / late = positive) for the Shift Clocking Summary
    const msPerMinute = 60000;
    const openingDriftMinutes = shift.createdAt
      ? Math.round((shift.createdAt.getTime() - shift.autoOpenTime.getTime()) / msPerMinute)
      : null;
    const closingDriftMinutes = shift.autoClosedAt
      ? Math.round((shift.autoClosedAt.getTime() - shift.autoCloseTime.getTime()) / msPerMinute)
      : null;

    // Drift records: created after autoCloseTime but before actualCloseTime (carried forward to next shift)
    let driftRecords: { menuName: string; quantityCooked: number; platesProduced: number; costPrice: number }[] = [];
    if (driftMinutes > 0 && shift.autoClosedAt) {
      const driftCookingRecords = await prisma.cookingRecord.findMany({
        where: {
          createdAt: {
            gte: shift.autoCloseTime,
            lt: shift.autoClosedAt,
          },
        },
        include: {
          stockSupply: { select: { name: true, costPrice: true } },
        },
      });

      driftRecords = driftCookingRecords.map((record) => ({
        menuName: record.stockSupply.name,
        quantityCooked: Number(record.quantityCooked),
        platesProduced: Number(record.platesActual ?? record.platesExpected),
        costPrice: Number(record.stockSupply.costPrice ?? 0),
      }));
    }

    // Unassigned carry-over brought in from the previous shift. These plates are
    // produced but not yet allocated, and stay independent until assigned via the
    // cooking-record allocation UI.
    const previousShift = await prisma.shift.findFirst({
      where: { isOpen: false, autoOpenTime: { lt: shift.autoOpenTime } },
      orderBy: { autoOpenTime: "desc" },
      include: { snapshots: { select: { menuId: true, closingPlates: true } } },
    });
    let unassignedCarryOver: {
      total: number;
      batches: { stockSupplyName: string; totalProduced: number; totalAssigned: number; unassigned: number }[];
    } = { total: 0, batches: [] };
    if (previousShift) {
      const prevBatches = await computeShiftUnassignedBatches(previousShift);
      unassignedCarryOver = {
        total: prevBatches.total,
        batches: prevBatches.batches.map((b) => ({
          stockSupplyName: b.stockSupplyName,
          totalProduced: b.totalProduced,
          totalAssigned: b.totalAssigned,
          unassigned: b.unassigned,
        })),
      };
    }

    res.json({
      shift: {
        id: shift.id,
        type: shift.type,
        operationDay: shift.operationDay,
        autoOpenTime: shift.autoOpenTime,
        autoCloseTime: shift.autoCloseTime,
        openingDriftMinutes,
        closingDriftMinutes,
        driftMinutes,
        isOpen: shift.isOpen,
        autoClosed: shift.autoClosed,
        finalClosedBy: shift.finalClosedBy,
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
      payments,
      drift: {
        minutes: driftMinutes,
        records: driftRecords,
      },
      unassignedCarryOver,
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
