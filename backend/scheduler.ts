import prisma from "./db/db.js";

// Daily shift auto-creation from active ShiftConfig.
// Creates one shift per configured time for every single day (not once).
// Operational date (Shift.operationDay) = calendar date of autoOpenTime, never today.
// Midnight-crossing handled: if closeTime <= openTime, close is next-day.
// Carry-forward opening snapshot uses previous same-type shift closingPlates.
export async function autoCreateShifts() {
  const now = new Date();
  const configs = await prisma.shiftConfig.findMany({
    where: { isActive: true },
    orderBy: { autoOpenTime: "asc" },
  });

  for (const cfg of configs) {
    try {
      const base = new Date();
      // Parse HH:MM strings to Date objects anchored to "today"
      const [openH, openM] = cfg.autoOpenTime.split(":").map(Number);
      const [closeH, closeM] = cfg.autoCloseTime.split(":").map(Number);
      const openTime = new Date(base.getFullYear(), base.getMonth(), base.getDate(), openH, openM, 0);
      let closeTime = new Date(base.getFullYear(), base.getMonth(), base.getDate(), closeH, closeM, 0);

      // Midnight crossing: if close <= open, close is next calendar day
      if (closeTime.getTime() <= openTime.getTime()) {
        closeTime.setDate(closeTime.getDate() + 1);
      }

      // Skip if shift hasn't opened yet (with 60s buffer for tick lag)
      if (now.getTime() < openTime.getTime() - 60_000) {
        continue;
      }

      // Operational day (Shift.operationDay) = calendar date of the open time, never "today"
      const operationDay = new Date(openTime.getFullYear(), openTime.getMonth(), openTime.getDate());

      // Skip if shift already exists for this type + operational day
      const existing = await prisma.shift.findFirst({
        where: { type: cfg.type, operationDay: operationDay },
      });
      if (existing) {
        continue;
      }

      await prisma.$transaction(async (tx) => {
        const shift = await tx.shift.create({
          data: {
            type: cfg.type,
            operationDay: operationDay,
            autoOpenTime: openTime,
            autoCloseTime: closeTime,
            isOpen: true,
          },
        });

        // Carry-forward: previous closed shift of same type -> closingPlates
        const prevShift = await tx.shift.findFirst({
          where: { isOpen: false, type: cfg.type },
          orderBy: { autoOpenTime: "desc" },
          include: {
            snapshots: { select: { menuId: true, closingPlates: true } },
          },
        });
        const prevClosingByMenu = new Map<string, number | null>();
        if (prevShift && prevShift.snapshots) {
          for (const snap of prevShift.snapshots) {
            prevClosingByMenu.set(snap.menuId, snap.closingPlates);
          }
        }

        // Take opening snapshot of all active menu items
        const activeMenus = await tx.menu.findMany({
          where: { isAvailable: true },
          select: { id: true, stock: true },
        });

        for (const menu of activeMenus) {
          const prevPlates = prevClosingByMenu.get(menu.id);
          const openingPlates = prevPlates != null ? Number(prevPlates) : (menu.stock ?? 0);

          await tx.shiftSnapshot.create({
            data: {
              shiftId: shift.id,
              menuId: menu.id,
              openingPlates,
              platesSold: 0,
              platesWasted: 0,
            },
          });
        }
      });

      console.log(`[scheduler] Auto-created ${cfg.type} shift for operational day ${operationDay.toISOString().split("T")[0]} (open ${cfg.autoOpenTime}, close ${cfg.autoCloseTime})`);
    } catch (e) {
      console.error(`[scheduler] Auto-create failed for ${cfg.type} (${cfg.autoOpenTime}):`, e);
    }
  }
}

// Auto-capture snapshot at scheduled close time.
// Does NOT close the shift - keeps isOpen=true so staff can manually close later.
// Returns shifts that were auto-captured.
export async function autoCloseExpiredShifts() {
  const now = new Date();

  const expiredShifts = await prisma.shift.findMany({
    where: {
      isOpen: true,
      autoCloseTime: { lte: now },
      autoClosed: false,
    },
  });

  const autoClosedShifts: Awaited<ReturnType<typeof prisma.shift.findUnique>>[] = [];

  for (const shift of expiredShifts) {
    try {
      const autoClosed = await prisma.$transaction(async (tx) => {
        // Mark shift as auto-closed but keep isOpen=true for manual close
        await tx.shift.update({
          where: { id: shift.id },
          data: {
            autoClosed: true,
            autoClosedAt: now,
            isOpen: shift.type === "NIGHT" ? false : true,
            finalCloseSource: shift.type === "NIGHT" ? "AUTO" : null,
          },
        });

        // Capture auto-close snapshot (current menu stock at scheduled close time)
        const snapshots = await tx.shiftSnapshot.findMany({
          where: { shiftId: shift.id },
          include: { menu: { select: { id: true, stock: true } } },
        });

        for (const snapshot of snapshots) {
          const currentStock = snapshot.menu.stock ?? 0;
          await tx.shiftSnapshot.update({
            where: { id: snapshot.id },
            data: {
              autoClosePlates: currentStock,
              autoCloseTime: now,
            },
          });
        }

        return tx.shift.findUnique({
          where: { id: shift.id },
          include: {
            snapshots: { include: { menu: { select: { id: true, name: true } } } },
          },
        });
      });

      if (autoClosed) {
        autoClosedShifts.push(autoClosed);
        console.log(
          `[scheduler] Auto-captured ${autoClosed.type} shift ${autoClosed.id} at ${now.toISOString()} (scheduled ${shift.autoCloseTime.toISOString()})`
        );
      }
    } catch (e) {
      console.error(`Error auto-capturing shift ${shift.id}:`, e);
    }
  }

  return autoClosedShifts;
}

let running = false;

export function startScheduler(intervalMs = 60_000) {
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      // First: create any missing daily shifts (one per active config, per operational day)
      await autoCreateShifts();

      const autoClosedShifts = await autoCloseExpiredShifts();
      if (autoClosedShifts.length > 0) {
        console.log(`[scheduler] Auto-captured ${autoClosedShifts.length} shift(s)`);
      }
    } catch (e) {
      console.error("[scheduler] Auto-capture tick failed:", e);
    } finally {
      running = false;
    }
  };

  void tick();
  const timer = setInterval(tick, intervalMs);

  return () => clearInterval(timer);
}