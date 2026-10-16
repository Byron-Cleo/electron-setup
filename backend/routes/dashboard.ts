import { Router } from "express";
import prisma from "../db/db.js";
import { shiftActualEndTime } from "./dailyReport.js";

const router = Router();

// Build the current running shift's effective window, matching the shift
// REPORT exactly so the dashboard can never disagree with it. effectiveStart =
// max(own open, immediately-preceding shift's actual end); effectiveEnd for a
// RUNNING shift = now (a still-open shift owns everything placed so far,
// including its drift period). The predecessor is the shift with the latest
// autoOpenTime strictly before this one — the same immediate-predecessor rule
// dailyReport.ts uses.
async function currentShiftWindow(shift: {
  autoOpenTime: Date;
}): Promise<{ start: Date; end: Date }> {
  const preceding = await prisma.shift.findFirst({
    where: { autoOpenTime: { lt: shift.autoOpenTime } },
    orderBy: { autoOpenTime: "desc" },
    select: {
      finalCloseSource: true,
      finalClosedAt: true,
      autoClosedAt: true,
      autoCloseTime: true,
    },
  });
  const precedingEnd = preceding ? shiftActualEndTime(preceding) : null;
  const start = precedingEnd
    ? new Date(Math.max(shift.autoOpenTime.getTime(), precedingEnd.getTime()))
    : shift.autoOpenTime;
  return { start, end: new Date() };
}

// Local calendar-day key (YYYY-MM-DD) for grouping the 7-day trend, matching
// the operator's chosen "calendar day of createdAt" semantics.
function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Dashboard "at a glance" summary: current running shift orders/revenue, the
// outstanding unpaid backlog, and paid revenue per calendar day for the last
// 7 days. One aggregate call so the page needs a single request.
router.get("/summary", async (_req, res) => {
  try {
    const shift = await prisma.shift.findFirst({
      where: { isOpen: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        operationDay: true,
        autoOpenTime: true,
        autoCloseTime: true,
      },
    });

    let ordersSoFar = 0;
    let revenueSoFar = 0;

    if (shift) {
      const window = await currentShiftWindow({
        autoOpenTime: shift.autoOpenTime,
      });
      const shiftOrders = await prisma.order.findMany({
        where: {
          createdAt: { gte: window.start, lt: window.end },
          isVoid: false,
        },
        select: { isPaid: true, totalPrice: true },
      });
      ordersSoFar = shiftOrders.length;
      revenueSoFar = shiftOrders
        .filter((o) => o.isPaid)
        .reduce((sum, o) => sum + Number(o.totalPrice), 0);
    }

    // Outstanding unpaid backlog — same predicate as /orders/unpaid-count
    // (money the customer walked out on, whether or not a customer is
    // attached). Excludes orders still pending collection on the running shift.
    const unpaidWhere = {
      unpaidAcknowledged: true,
      isPaid: false,
      isVoid: false,
    };
    const [unpaidCount, unpaidAgg] = await Promise.all([
      prisma.order.count({ where: unpaidWhere }),
      prisma.order.aggregate({
        where: unpaidWhere,
        _sum: { totalPrice: true },
      }),
    ]);
    const unpaidTotal = Number(unpaidAgg._sum.totalPrice ?? 0);

    // Paid revenue per local calendar day, oldest → today (7 entries). The
    // fetch starts at local midnight 6 days ago so each bucket is complete.
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const rangeStart = new Date(todayStart);
    rangeStart.setDate(rangeStart.getDate() - 6);

    const paidOrders = await prisma.order.findMany({
      where: {
        isPaid: true,
        isVoid: false,
        createdAt: { gte: rangeStart },
      },
      select: { totalPrice: true, createdAt: true },
    });

    const sumsByDay = new Map<string, number>();
    for (const order of paidOrders) {
      const key = localDayKey(order.createdAt);
      sumsByDay.set(key, (sumsByDay.get(key) ?? 0) + Number(order.totalPrice));
    }

    const last7Days: { date: string; label: string; value: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(rangeStart);
      d.setDate(rangeStart.getDate() + i);
      const key = localDayKey(d);
      last7Days.push({
        date: key,
        label: DAY_LABELS[d.getDay()],
        value: sumsByDay.get(key) ?? 0,
      });
    }

    res.json({
      currentShift: shift
        ? {
            id: shift.id,
            type: shift.type,
            operationDay: shift.operationDay,
            autoOpenTime: shift.autoOpenTime,
            autoCloseTime: shift.autoCloseTime,
          }
        : null,
      ordersSoFar,
      revenueSoFar,
      unpaidOutstanding: { count: unpaidCount, total: unpaidTotal },
      last7Days,
    });
  } catch (e) {
    console.error("Error building dashboard summary:", e);
    res.status(500).json({ error: "Failed to build dashboard summary" });
  }
});

export default router;
