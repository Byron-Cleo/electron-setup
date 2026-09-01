import { Router } from "express";
import prisma from "../db/db.js";
import { autoCloseExpiredShifts } from "../scheduler.js";

const router = Router();

// List shifts, optionally filtered by date (YYYY-MM-DD)
router.get("/", async (req, res) => {
  const { date } = req.query;

  try {
    const where: { date?: { gte: Date; lt: Date } } = {};

    if (date) {
      const targetDate = new Date(String(date));
      if (isNaN(targetDate.getTime())) {
        return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
      }
      const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1);
      where.date = { gte: startOfDay, lt: endOfDay };
    }

    const shifts = await prisma.shift.findMany({
      where,
      orderBy: [{ date: "desc" }, { autoOpenTime: "asc" }],
      include: {
        openedBy: { select: { id: true, name: true } },
        closedBy: { select: { id: true, name: true } },
      },
    });

    res.json(shifts);
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
        openedBy: { select: { id: true, name: true } },
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

// Get shift by ID
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const shift = await prisma.shift.findUnique({
      where: { id },
      include: {
        openedBy: { select: { id: true, name: true } },
        closedBy: { select: { id: true, name: true } },
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
  const { closedById, declaredCash, declaredMpesa, waste } = req.body;

  if (!closedById) {
    return res.status(400).json({ error: "closedById is required" });
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
          closedById,
          actualCloseTime: now,
          finalClosedAt: now,
          finalClosedById: closedById,
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
        const autoPlates = snapshot.autoClosePlates ?? null;
        const autoTime = snapshot.autoCloseTime ? new Date(snapshot.autoCloseTime) : null;

        // Compute drift
        const driftPlates = autoPlates !== null ? currentStock - autoPlates : null;
        const driftMinutes = autoTime && autoCloseTime
          ? Math.round((now.getTime() - autoTime.getTime()) / 60000)
          : null;

        await tx.shiftSnapshot.update({
          where: { id: snapshot.id },
          data: {
            closingPlates: currentStock,
            manualClosePlates: currentStock,
            platesSoldAfterAutoClose: snapshot.platesSold,
            manualCloseTime: now,
            driftPlates,
            driftMinutes,
          },
        });
      }

      return tx.shift.findUnique({
        where: { id },
        include: {
          openedBy: { select: { id: true, name: true } },
          closedBy: { select: { id: true, name: true } },
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
