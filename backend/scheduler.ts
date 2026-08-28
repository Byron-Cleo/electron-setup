import prisma from "./db/db.js";

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