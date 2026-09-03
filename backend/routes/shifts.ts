import { Router } from "express";
import prisma from "../db/db.js";
import { autoCloseExpiredShifts } from "../scheduler.js";

const router = Router();

// Shared helper to parse a YYYY-MM-DD query value into { start, end } boundaries
// (UTC midnight so it aligns with the @db.Date column regardless of timezone).
function parseDateQueryRange(value: string): { gte: Date; lt: Date } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const start = new Date(Date.UTC(y, m - 1, d));
  const end = new Date(Date.UTC(y, m - 1, d + 1));
  return { gte: start, lt: end };
}

// List shifts, optionally filtered by a single date (YYYY-MM-DD), a date range
// (from/to), and/or a shift type. Each shift is enriched with read-only summary
// fields (orderCount, voidCount, revenue, driftMinutes) computed from existing
// relations. Sorted newest-first.
router.get("/", async (req, res) => {
  const { date, from, to, type } = req.query;

  try {
    const where: {
      operationDay?: { gte?: Date; lt?: Date };
      type?: string;
    } = {};

    if (date) {
      const range = parseDateQueryRange(String(date));
      if (!range) {
        return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
      }
      where.operationDay = range;
    } else if (from || to) {
      // Build a partial range — only the provided bounds are applied.
      let gte: Date | undefined;
      let lt: Date | undefined;
      if (from) {
        const r = parseDateQueryRange(String(from));
        if (!r) return res.status(400).json({ error: "Invalid from format. Use YYYY-MM-DD" });
        gte = r.gte;
      }
      if (to) {
        const r = parseDateQueryRange(String(to));
        if (!r) return res.status(400).json({ error: "Invalid to format. Use YYYY-MM-DD" });
        lt = r.lt;
      }
      where.operationDay = { ...(gte ? { gte } : {}), ...(lt ? { lt } : {}) };
    }

    if (type && type !== "") {
      where.type = String(type);
    }

    const shifts = await prisma.shift.findMany({
      where,
      orderBy: { autoOpenTime: "desc" },
      include: {
        finalClosedBy: { select: { id: true, name: true } },
        orders: {
          select: {
            id: true,
            isVoid: true,
            isPaid: true,
            totalPrice: true,
            voidedById: true,
          },
        },
        snapshots: { select: { id: true } },
      },
    });

    // Enrich each shift with summary fields (read-only aggregation).
    const enriched = shifts.map((shift) => {
      const totalOrders = shift.orders.length;
      const voidCount = shift.orders.filter((o) => o.isVoid).length;
      const revenue = shift.orders
        .filter((o) => o.isPaid && !o.isVoid)
        .reduce((sum, o) => sum + Number(o.totalPrice), 0);
      const driftMinutes =
        shift.autoClosedAt && shift.autoCloseTime
          ? Math.round(
              (new Date(shift.autoClosedAt).getTime() - new Date(shift.autoCloseTime).getTime()) /
                60000,
            )
          : null;

      return {
        ...shift,
        orders: undefined,
        snapshots: undefined,
        orderCount: totalOrders,
        voidCount,
        revenue,
        driftMinutes,
      };
    });

    res.json(enriched);
  } catch (e) {
    console.error("Error listing shifts:", e);
    res.status(500).json({ error: "Failed to list shifts" });
  }
});

// Get current open shift
router.get("/current", async (_req, res) => {
  try {
    const shift = await prisma.shift.findFirst({
      where: { isOpen: true },
      orderBy: { createdAt: "desc" },
      include: {
        finalClosedBy: { select: { id: true, name: true } },
        snapshots: { include: { menu: { select: { id: true, name: true } } } },
        orders: {
          select: {
            id: true,
            orderNumber: true,
            mealType: true,
            totalPrice: true,
            paymentMethod: true,
            paymentType: true,
            isPaid: true,
            isVoid: true,
            unpaidAcknowledged: true,
            unpaidAcknowledgedById: true,
            unpaidAcknowledgedAt: true,
            shiftId: true,
            createdAt: true,
            User: { select: { id: true, name: true } },
          },
        },
      },
    });
    res.json(shift);
  } catch (e) {
    console.error("Error getting current shift:", e);
    res.status(500).json({ error: "Failed to get current shift" });
  }
});

// Get the oldest open manual-config shift that needs to be closed next.
// Only manual-config shifts with finalCloseSource = null are eligible (never manually closed yet).
router.get("/to-close", async (_req, res) => {
  try {
    const manualConfigs = await prisma.shiftConfig.findMany({
      where: { manual: true },
      select: { type: true },
    });
    const manualTypes = manualConfigs.map((c) => c.type);

    if (manualTypes.length === 0) {
      return res.json(null);
    }

    const shift = await prisma.shift.findFirst({
      where: {
        isOpen: true,
        finalCloseSource: null,
        type: { in: manualTypes },
      },
      orderBy: { autoOpenTime: "asc" },
      include: {
        finalClosedBy: { select: { id: true, name: true } },
      },
    });
    res.json(shift);
  } catch (e) {
    console.error("Error getting shift to close:", e);
    res.status(500).json({ error: "Failed to get shift to close" });
  }
});

// Get shift by ID
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const shift = await prisma.shift.findUnique({
      where: { id },
      include: {
        finalClosedBy: { select: { id: true, name: true } },
        snapshots: { include: { menu: { select: { id: true, name: true } } } },
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
    res.json(shift);
  } catch (e) {
    console.error("Error getting shift:", e);
    res.status(500).json({ error: "Failed to get shift" });
  }
});

// Close a shift (manual close by staff)
// Allows closing even if shift was auto-captured by scheduler
router.post("/:id/close", async (req, res) => {
  const { id } = req.params;
  const { finalClosedById, declaredCash, declaredMpesa, waste } = req.body;

  if (!finalClosedById) {
    return res.status(400).json({ error: "finalClosedById is required" });
  }

  try {
    const shift = await prisma.shift.findUnique({
      where: { id },
      include: { orders: true },
    });

    if (!shift) {
      return res.status(404).json({ error: "Shift not found" });
    }

    if (!shift.isOpen && shift.finalClosedAt) {
      return res.status(400).json({ error: "Shift is already finalized" });
    }

    // Manual close is only for shifts configured with manual close (manual=true).
    // Auto-closed shifts are finalized by the scheduler at their autoCloseTime.
    if (shift.finalCloseSource === "AUTO") {
      return res.status(400).json({
        error: "This shift was auto-closed at its scheduled close time. Manual close is only allowed for shifts configured with manual close.",
      });
    }

    // Block close while any order is unpaid and not marked-as-unpaid by a manager.
    // Unpaid orders can only be resolved by marking them as unpaid (never voided here).
    const blockingUnpaid = shift.orders.filter(
      (o) => !o.isVoid && !o.isPaid && !o.unpaidAcknowledged
    );
    if (blockingUnpaid.length > 0) {
      return res.status(409).json({
        error: `Cannot close shift: ${blockingUnpaid.length} unpaid order(s) are not marked as unpaid. Resolve them before closing.`,
        blockingUnpaid: blockingUnpaid.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          totalPrice: o.totalPrice,
        })),
      });
    }

    const now = new Date();

    // Close shift and take manual closing snapshot
    const closedShift = await prisma.$transaction(async (tx) => {
      await tx.shift.update({
        where: { id },
        data: {
          isOpen: false,
          finalClosedById,
          finalClosedAt: now,
          finalCloseSource: "MANUAL",
          ...(declaredCash !== undefined && declaredCash !== null && declaredCash !== ""
            ? { declaredCash: Number(declaredCash) }
            : {}),
          ...(declaredMpesa !== undefined && declaredMpesa !== null && declaredMpesa !== ""
            ? { declaredMpesa: Number(declaredMpesa) }
            : {}),
        },
      });

      // Take manual closing snapshot and compute drift
      const snapshots = await tx.shiftSnapshot.findMany({
        where: { shiftId: id },
        include: { menu: { select: { id: true, stock: true } } },
      });

      const autoCloseTime = shift.autoClosedAt ? new Date(shift.autoClosedAt) : null;

      // Apply declared waste per menu item (removes wasted plates from inventory)
      const wasteEntries: Array<{ menuId?: string; plates?: number }> = Array.isArray(waste) ? waste : [];
      for (const w of wasteEntries) {
        if (!w.menuId) continue;
        const wastedPlates = Number(w.plates ?? 0) || 0;
        const snap = snapshots.find((s) => s.menuId === w.menuId);
        if (snap) {
          await tx.shiftSnapshot.update({
            where: { id: snap.id },
            data: { platesWasted: wastedPlates },
          });
        }
        // Reduce live Menu.stock by wasted plates (wasted = removed from sellable pool)
        const menuRow = await tx.menu.findUnique({ where: { id: w.menuId } });
        if (menuRow) {
          await tx.menu.update({
            where: { id: w.menuId },
            data: { stock: Math.max(0, (menuRow.stock ?? 0) - wastedPlates) },
          });
        }
      }

      for (const snapshot of snapshots) {
        const currentStock = snapshot.menu.stock ?? 0;
        const autoPlates = snapshot.closingStockAtAutoClose ?? null;
        const autoTime = snapshot.autoCloseTime ? new Date(snapshot.autoCloseTime) : null;

        // Compute drift
        const driftPlates = autoPlates !== null ? currentStock - autoPlates : null;
        const driftMinutes = autoTime && autoCloseTime
          ? Math.round((now.getTime() - autoTime.getTime()) / 60000)
          : null;

        await tx.shiftSnapshot.update({
          where: { id: snapshot.id },
          data: {
            closingStockAtManualClose: currentStock,
            manualCloseTime: now,
            driftPlates,
            driftMinutes,
          },
        });
      }

      return tx.shift.findUnique({
        where: { id },
        include: {
          finalClosedBy: { select: { id: true, name: true } },
          snapshots: { include: { menu: { select: { id: true, name: true } } } },
        },
      });
    });

    res.json(closedShift);
  } catch (e) {
    console.error("Error closing shift:", e);
    res.status(500).json({ error: "Failed to close shift" });
  }
});

// Auto-capture shifts at scheduled close time (called by scheduler)
router.post("/auto-capture", async (_req, res) => {
  try {
    const capturedShifts = await autoCloseExpiredShifts();
    res.json({ captured: capturedShifts.length, shifts: capturedShifts });
  } catch (e) {
    console.error("Error auto-capturing shifts:", e);
    res.status(500).json({ error: "Failed to auto-capture shifts" });
  }
});

export default router;
