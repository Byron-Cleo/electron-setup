import { Router } from "express";
import prisma from "../db/db.js";
import { ShiftType } from "../db/generated/prisma/client.js";
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
      orderBy: [{ date: "desc" }, { openingTime: "asc" }],
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
          select: { id: true, mealType: true, totalPrice: true, isVoid: true, createdAt: true },
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

// Open a new shift
router.post("/open", async (req, res) => {
  const { type, openedById } = req.body;

  if (!type || !openedById) {
    return res.status(400).json({ error: "type and openedById are required" });
  }

  if (!Object.values(ShiftType).includes(type)) {
    return res.status(400).json({ error: `Invalid shift type. Must be one of: ${Object.values(ShiftType).join(", ")}` });
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  try {
    // Check if shift already open for this type+date
    const existing = await prisma.shift.findUnique({
      where: { type_date: { type, date: today } },
    });

    if (existing) {
      if (existing.isOpen) {
        return res.json(existing);
      }
      return res.status(409).json({ error: "Shift already closed for this period" });
    }

    // Calculate times based on shift type
    let openingTime: Date;
    let autoCloseTime: Date;

    if (type === ShiftType.DAY) {
      openingTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 5, 30, 0);
      autoCloseTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 17, 30, 0);
    } else {
      openingTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 17, 30, 0);
      // Night shift closes at 5:30 AM next day
      autoCloseTime = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 5, 30, 0);
    }

    // Create shift with opening snapshot
    const shift = await prisma.$transaction(async (tx) => {
      const created = await tx.shift.create({
        data: {
          type,
          date: today,
          openingTime,
          autoCloseTime,
          actualOpeningTime: now,
          isOpen: true,
          openedById,
        },
      });

      // Carry-forward from the most recent closed shift: a menu's opening plates
      // are its previous shift's closing plates (assigned carry-over). Unassigned
      // production from the previous shift is kept independent and assigned later
      // via the cooking-record allocation UI, so it is NOT folded into the opening
      // snapshot.
      const previousShift = await tx.shift.findFirst({
        where: { isOpen: false },
        orderBy: { openingTime: "desc" },
        select: { snapshots: { select: { menuId: true, closingPlates: true } } },
      });
      const prevClosingByMenu = new Map<string, number>();
      if (previousShift) {
        for (const snap of previousShift.snapshots) {
          if (snap.closingPlates != null) {
            prevClosingByMenu.set(snap.menuId, Number(snap.closingPlates));
          }
        }
      }

      // Take opening snapshot of all active menu items
      const activeMenus = await tx.menu.findMany({
        where: { isAvailable: true },
        select: { id: true, stock: true },
      });

      if (activeMenus.length > 0) {
        await tx.shiftSnapshot.createMany({
          data: activeMenus.map((menu) => ({
            shiftId: created.id,
            menuId: menu.id,
            openingPlates: prevClosingByMenu.has(menu.id)
              ? (prevClosingByMenu.get(menu.id) ?? 0)
              : (menu.stock ?? 0),
          })),
        });
      }

      return tx.shift.findUnique({
        where: { id: created.id },
        include: {
          openedBy: { select: { id: true, name: true } },
          snapshots: { include: { menu: { select: { id: true, name: true } } } },
        },
      });
    });

    res.status(201).json(shift);
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2002") {
      return res.status(409).json({ error: "Shift already exists for this period" });
    }
    console.error("Error opening shift:", e);
    res.status(500).json({ error: "Failed to open shift" });
  }
});

// Close a shift (manual close by staff)
// Allows closing even if shift was auto-captured by scheduler
router.post("/:id/close", async (req, res) => {
  const { id } = req.params;
  const { closedById, declaredCash, declaredMpesa } = req.body;

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
