import { Router } from "express";
import prisma from "../db/db.js";
import { computeShiftUnassignedBatches } from "./shiftCarryOver.js";
import { round2 } from "../pools.js";

const router = Router();

// An order belongs to a shift's operationDay when createdAt falls within
// [operationDay, operationDay + 1d) — UTC-midnight alignment, the same
// convention used by parseDateQueryRange. Applied ON TOP of shift membership:
// every shift keeps its own generated data, and off-date (stale) orders never
// leak into a shift's report.
function belongsToOperationDay(createdAt: Date, operationDay: Date): boolean {
  const t = new Date(createdAt).getTime();
  const start = operationDay.getTime();
  return t >= start && t < start + 86_400_000;
}

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

    // A shift's report uses all orders attached to this shift (shift.orders),
    // which represents exactly the orders placed while the shift was the current
    // shift (including any drift period). This keeps the report aligned with the
    // shift's actual open/close window.
    const dayOrders = shift.orders;

    // Revenue is computed from paid non-void orders only. Unpaid (including
    // manager-marked-unpaid) orders stay in the total count but are excluded
    // from revenue and reported separately in the payment summary.
    const activeOrders = dayOrders.filter((o) => !o.isVoid);
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
    // closingStockAtManualClose yet, so use the current live menu stock as the
    // "Final Closing Stock" value and flag it so the UI can label it "Current".
    const isOpenShift = shift.isOpen;
    const plateMovement = shift.snapshots
      .map((snapshot) => {
        // Snapshot counters are Decimal(12,2) because a weighted supply leaves a
        // fractional pool. Coerce once here so the arithmetic below stays exact.
        const opening = Number(snapshot.openingPlates);
        const sold = Number(snapshot.platesSold);
        const soldAtAutoClose =
          snapshot.platesSoldAtAutoClose !== null && snapshot.platesSoldAtAutoClose !== undefined
            ? Number(snapshot.platesSoldAtAutoClose)
            : null;
        const platesCooked = platesCookedByMenu.get(snapshot.menuId) ?? 0;
        const closingStock = round2(opening + platesCooked - sold);
        const closingStockAtManualClose = isOpenShift
          ? Number(snapshot.menu.stock ?? 0)
          : snapshot.closingStockAtManualClose !== null && snapshot.closingStockAtManualClose !== undefined
            ? Number(snapshot.closingStockAtManualClose)
            : null;
        const driftSold = soldAtAutoClose !== null ? round2(sold - soldAtAutoClose) : null;
        // Auto closing stock = remaining plates after opening + cooked − sold before auto-close
        const closingStockAtAutoClose =
          soldAtAutoClose !== null
            ? round2(opening + platesCooked - soldAtAutoClose)
            : snapshot.closingStockAtAutoClose !== null && snapshot.closingStockAtAutoClose !== undefined
              ? Number(snapshot.closingStockAtAutoClose)
              : null;
        const isLiveCurrent = isOpenShift;

        return {
          menuId: snapshot.menuId,
          menuName: snapshot.menu.name,
          sellingMode: snapshot.sellingMode,
          openingPlates: opening,
          platesCooked,
          platesSold: sold,
          platesSoldAtAutoClose: soldAtAutoClose,
          driftSold,
          closingStock,
          platesWasted: Number(snapshot.platesWasted ?? 0),
          closingStockAtAutoClose,
          driftMinutes: snapshot.driftMinutes ?? null,
          closingStockAtManualClose,
          isLiveCurrent,
        };
      })
      .filter((row) => row.platesSold > 0 || row.platesCooked > 0);

    // A SHARED pool is one set of plates mirrored onto every dish it feeds, so
    // summing its figures per dish would report 4x the food that was actually
    // cooked. Count each shared pool once (on its first dish) and mark the
    // other dishes as mirrors, which the UI shows but the totals skip.
    const sharedSupplyByMenu = new Map<string, string>();
    const supplyLinks = await prisma.stockSupplyMenu.findMany({
      where: { menuId: { in: plateMovement.map((r) => r.menuId) } },
      select: { menuId: true, stockSupplyId: true },
    });
    for (const link of supplyLinks) {
      if (!sharedSupplyByMenu.has(link.menuId)) sharedSupplyByMenu.set(link.menuId, link.stockSupplyId);
    }
    const countedSharedPools = new Set<string>();
    const plateMovementDeduped = plateMovement.map((row) => {
      if (row.sellingMode !== "SHARED") return { ...row, isSharedMirror: false };
      const supplyId = sharedSupplyByMenu.get(row.menuId) ?? row.menuId;
      const first = !countedSharedPools.has(supplyId);
      countedSharedPools.add(supplyId);
      return { ...row, isSharedMirror: !first };
    });

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

    // Unassigned plates brought IN from the previous shift. These plates are
    // produced but not yet allocated, and stay independent until assigned via the
    // cooking-record allocation UI.
    const previousShift = await prisma.shift.findFirst({
      where: { isOpen: false, autoOpenTime: { lt: shift.autoOpenTime } },
      orderBy: { autoOpenTime: "desc" },
      include: { snapshots: { select: { menuId: true, closingStockAtManualClose: true } } },
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

    // Unassigned plates produced by THIS shift that are still not allocated to
    // any menu — these carry OUT to the next shift. Mirror of the incoming
    // block above so the report shows both sides of the handoff.
    const currentUnassigned = await computeShiftUnassignedBatches(shift);
    const unassignedOutgoing = {
      total: currentUnassigned.total,
      batches: currentUnassigned.batches.map((b) => ({
        stockSupplyName: b.stockSupplyName,
        totalProduced: b.totalProduced,
        totalAssigned: b.totalAssigned,
        unassigned: b.unassigned,
      })),
    };

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
        autoClosedAt: shift.autoClosedAt,
        finalClosedBy: shift.finalClosedBy,
      },
      plateMovement: plateMovementDeduped,
      // Summed from non-mirror rows only, so a shared pool counted once.
      plates: {
        cooked: round2(plateMovementDeduped.reduce((s, r) => s + (r.isSharedMirror ? 0 : r.platesCooked), 0)),
        sold: round2(plateMovementDeduped.reduce((s, r) => s + (r.isSharedMirror ? 0 : r.platesSold), 0)),
        opening: round2(plateMovementDeduped.reduce((s, r) => s + (r.isSharedMirror ? 0 : r.openingPlates), 0)),
        closing: round2(plateMovementDeduped.reduce((s, r) => s + (r.isSharedMirror ? 0 : r.closingStock), 0)),
      },
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
        totalOrders: dayOrders.length,
        voidedOrders: dayOrders.filter((o) => o.isVoid).length,
      },
      payments,
      drift: {
        minutes: driftMinutes,
        records: driftRecords,
      },
      unassignedCarryOver,
      unassignedOutgoing,
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
