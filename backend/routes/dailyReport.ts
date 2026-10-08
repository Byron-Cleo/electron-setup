import { Router } from "express";
import prisma from "../db/db.js";
import { computeShiftUnassignedBatches } from "./shiftCarryOver.js";
import { round2, factorForServing } from "../pools.js";

const router = Router();

// A shift's ACTUAL end time — when it stopped serving. A final close wins
// (MANUAL = manager closed it; FORCED = system closed it at its drift
// deadline — a manager-extended shift owns its drift period either way),
// else the auto-close tick, else the scheduled close time (fallback for a
// shift with no close stamps). Reports pair this with effectiveStart so
// consecutive shifts form mutually exclusive windows and every order
// belongs to exactly one shift. Shared with the shift-list endpoint so its
// orderCount/revenue summaries always match the report.
export function shiftActualEndTime(shift: {
  finalCloseSource: string | null;
  finalClosedAt: Date | null;
  autoClosedAt: Date | null;
  autoCloseTime: Date;
}): Date {
  if (
    (shift.finalCloseSource === "MANUAL" || shift.finalCloseSource === "FORCED") &&
    shift.finalClosedAt
  ) {
    return shift.finalClosedAt;
  }
  if (shift.autoClosedAt) {
    return shift.autoClosedAt;
  }
  return shift.autoCloseTime;
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
      },
    });

    if (!shift) {
      return res.status(404).json({ error: "Shift not found" });
    }

    // Mutually exclusive time windows: every order belongs to exactly one
    // shift. The window opens at this shift's start time, or later when the
    // IMMEDIATELY PRECEDING shift is still serving (manual or forced
    // deadline) and actually ended, and closes at this shift's actual end
    // (exclusive bound). Drift-period orders stay with the extending shift,
    // and orders across midnight stay under this shift's (immutable)
    // operationDay — no calendar-day splitting.
    //
    // Only the immediate predecessor clamps the start — deliberately. An
    // OLDER shift closed out of order (a stale shift the manager finally
    // clicked days late) must not swallow this shift's window; the drift
    // limit on manual configs makes such out-of-order closes impossible
    // going forward, so the immediate predecessor is the only real overlap.
    const precedingShift = await prisma.shift.findFirst({
      where: { autoOpenTime: { lt: shift.autoOpenTime } },
      orderBy: { autoOpenTime: "desc" },
      select: { finalCloseSource: true, finalClosedAt: true, autoClosedAt: true, autoCloseTime: true },
    });

    const effectiveEnd = shiftActualEndTime(shift);
    const effectiveStart = precedingShift
      ? new Date(Math.max(shift.autoOpenTime.getTime(), shiftActualEndTime(precedingShift).getTime()))
      : shift.autoOpenTime;

    // Orders attributed strictly by the effective window — not by the
    // shift.orders relation (unreliable during drift/overlap) and not by
    // operationDay (which would split midnight-crossing shifts).
    const dayOrders = await prisma.order.findMany({
      where: {
        createdAt: { gte: effectiveStart, lt: effectiveEnd },
      },
      include: {
        OrderItem: true,
        User: { select: { name: true } },
      },
    });

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

    // Core cooking records: within the shift's effective window, so drift-period
    // cooking stays with the extending shift instead of leaking to the next one
    const cookingRecords = await prisma.cookingRecord.findMany({
      where: {
        createdAt: {
          gte: effectiveStart,
          lt: effectiveEnd,
        },
      },
      include: {
        stockSupply: { select: { costPrice: true } },
        cookingRecordMenus: { select: { menuId: true, platesAllocated: true } },
      },
    });

    // Production = the raw-material cost of the menus sold. Raw-material
    // costing is NOT implemented yet, so the figure is deliberately projected
    // as 0 (the UI marks the card "(Projection not yet implemented)") and
    // variance/margin stay consistent with the zero cost basis until real
    // costing lands later.

    // Aggregate plates cooked per menu item from splits
    const platesCookedByMenu = new Map<string, number>();
    for (const record of cookingRecords) {
      for (const crm of record.cookingRecordMenus) {
        const plates = Number(crm.platesAllocated);
        platesCookedByMenu.set(crm.menuId, (platesCookedByMenu.get(crm.menuId) ?? 0) + plates);
      }
    }

    // Plate sales are DERIVED from the same window orders the revenue comes
    // from — plate movement is order placement, so the report can never
    // disagree with its own orders (the snapshot tick tallies stay as the
    // structural record). Same weight as at placement: factor × qty per
    // OrderItem, non-void only (voids restore plates).
    const salesByMenu = new Map<string, { sold: number; soldBeforeAutoClose: number }>();
    const factorCache = new Map<string, number>();
    for (const order of dayOrders) {
      if (order.isVoid) continue;
      const beforeAutoClose = order.createdAt.getTime() < shift.autoCloseTime.getTime();
      for (const item of order.OrderItem) {
        const factorKey = `${item.menuId}|${item.portionId ?? ""}`;
        let factor = factorCache.get(factorKey);
        if (factor === undefined) {
          factor = await factorForServing(prisma, item.menuId, item.portionId);
          factorCache.set(factorKey, factor);
        }
        const plates = round2(factor * item.qty);
        const entry = salesByMenu.get(item.menuId) ?? { sold: 0, soldBeforeAutoClose: 0 };
        entry.sold = round2(entry.sold + plates);
        if (beforeAutoClose) {
          entry.soldBeforeAutoClose = round2(entry.soldBeforeAutoClose + plates);
        }
        salesByMenu.set(item.menuId, entry);
      }
    }

    // Calculate plate movement — only items that were cooked or sold.
    // For an open shift (live or awaiting manual close) there is no final
    // closingStockAtManualClose yet, so use the current live menu stock as the
    // "Final Closing Stock" value and flag it so the UI can label it "Current".
    const isOpenShift = shift.isOpen;
    const plateMovement = shift.snapshots
      .map((snapshot) => {
        // Sales figures are DERIVED from the window orders (salesByMenu) so
        // plate movement matches order placement exactly; opening/closing
        // stock and waste stay from the snapshot tick-stamps (they are stock
        // photos, attachment-independent). Coerce once so the arithmetic
        // below stays exact.
        const opening = Number(snapshot.openingPlates);
        const derived = salesByMenu.get(snapshot.menuId);
        const sold = derived?.sold ?? 0;
        // Pre-drift sales only exist once the shift was auto-captured — the
        // same derivation cut at the scheduled close time.
        const soldAtAutoClose = shift.autoClosed ? derived?.soldBeforeAutoClose ?? 0 : null;
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

    // Menus sold in the window but absent from this shift's snapshots — a
    // dish added mid-shift (created with no opening stock, e.g. Matumbo CFF
    // on 10-07) or one whose historical orders attached to a different
    // shift. It still sold on this shift, so it still gets a row: opening 0
    // (nothing existed when the shift opened), cooked from the window's
    // cooking records, sold derived from the window orders.
    const snapshotMenuIds = new Set(shift.snapshots.map((s) => s.menuId));
    const missingMenuIds = [...salesByMenu.keys()].filter((id) => !snapshotMenuIds.has(id));
    let plateMovementAll = plateMovement;
    if (missingMenuIds.length > 0) {
      const missingMenus = await prisma.menu.findMany({
        where: { id: { in: missingMenuIds } },
        select: { id: true, name: true, stock: true },
      });
      const missingLinks = await prisma.stockSupplyMenu.findMany({
        where: { menuId: { in: missingMenuIds } },
        select: { menuId: true, stockSupply: { select: { sellingMode: true } } },
      });
      const modeByMenu = new Map(missingLinks.map((l) => [l.menuId, l.stockSupply.sellingMode]));
      const appendedRows = missingMenus.map((menu) => {
        const derived = salesByMenu.get(menu.id);
        const sold = derived?.sold ?? 0;
        const soldAtAutoClose = shift.autoClosed ? derived?.soldBeforeAutoClose ?? 0 : null;
        const platesCooked = platesCookedByMenu.get(menu.id) ?? 0;
        const opening = 0;
        return {
          menuId: menu.id,
          menuName: menu.name,
          sellingMode: modeByMenu.get(menu.id) ?? "ALLOCATED",
          openingPlates: opening,
          platesCooked,
          platesSold: sold,
          platesSoldAtAutoClose: soldAtAutoClose,
          driftSold: soldAtAutoClose !== null ? round2(sold - soldAtAutoClose) : null,
          closingStock: round2(opening + platesCooked - sold),
          platesWasted: 0,
          closingStockAtAutoClose:
            soldAtAutoClose !== null
              ? round2(opening + platesCooked - soldAtAutoClose)
              : null,
          driftMinutes: null,
          closingStockAtManualClose: isOpenShift ? Number(menu.stock ?? 0) : null,
          isLiveCurrent: isOpenShift,
        };
      });
      plateMovementAll = [...plateMovement, ...appendedRows];
    }

    // A SHARED pool is one set of plates mirrored onto every dish it feeds, so
    // summing its figures per dish would report 4x the food that was actually
    // cooked. Count each shared pool once (on its first dish) and mark the
    // other dishes as mirrors, which the UI shows but the totals skip.
    const sharedSupplyByMenu = new Map<string, string>();
    const supplyLinks = await prisma.stockSupplyMenu.findMany({
      where: { menuId: { in: plateMovementAll.map((r) => r.menuId) } },
      select: { menuId: true, stockSupplyId: true },
    });
    for (const link of supplyLinks) {
      if (!sharedSupplyByMenu.has(link.menuId)) sharedSupplyByMenu.set(link.menuId, link.stockSupplyId);
    }
    const countedSharedPools = new Set<string>();
    const plateMovementDeduped = plateMovementAll.map((row) => {
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

    // Clocking drift (signed, early = negative / late = positive) for the Shift Clocking Summary.
    // A final close (MANUAL or FORCED) is when the shift actually stopped, so
    // its drift is measured against that moment — an auto-close tick alone
    // would report 0 for a shift that was actually closed hours late.
    const msPerMinute = 60000;
    const openingDriftMinutes = shift.createdAt
      ? Math.round((shift.createdAt.getTime() - shift.autoOpenTime.getTime()) / msPerMinute)
      : null;
    const finalCloseMs =
      (shift.finalCloseSource === "MANUAL" || shift.finalCloseSource === "FORCED") && shift.finalClosedAt
        ? shift.finalClosedAt.getTime()
        : null;
    const closingDriftMinutes = finalCloseMs !== null
      ? Math.round((finalCloseMs - shift.autoCloseTime.getTime()) / msPerMinute)
      : shift.autoClosedAt
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

    // Actual capture span of the window's orders — the exact createdAt of the
    // first and last order, so the report shows the timing the orders were
    // gathered between (always under this shift's operationDay).
    const orderTimes = dayOrders.map((o) => o.createdAt.getTime());
    const firstOrderAt = orderTimes.length > 0 ? new Date(Math.min(...orderTimes)) : null;
    const lastOrderAt = orderTimes.length > 0 ? new Date(Math.max(...orderTimes)) : null;

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
        finalClosedAt: shift.finalClosedAt,
        finalCloseSource: shift.finalCloseSource,
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
        totalCost: 0,
        totalSales,
        variance: totalSales,
        profitMargin: totalSales > 0 ? "100.0%" : "0%",
      },
      summary: {
        totalOrders: dayOrders.length,
        voidedOrders: dayOrders.filter((o) => o.isVoid).length,
        firstOrderAt,
        lastOrderAt,
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
