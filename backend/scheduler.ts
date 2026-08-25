import prisma from "./db/db.js";

// Close all open shifts whose scheduled close time has passed.
// Returns the closed shifts (with opening snapshots included).
export async function autoCloseExpiredShifts() {
  const now = new Date();

  const expiredShifts = await prisma.shift.findMany({
    where: {
      isOpen: true,
      autoCloseTime: { lte: now },
    },
  });

  const closedShifts: Awaited<ReturnType<typeof prisma.shift.findUnique>>[] = [];

  for (const shift of expiredShifts) {
    try {
      const closed = await prisma.$transaction(async (tx) => {
        await tx.shift.update({
          where: { id: shift.id },
          data: {
            isOpen: false,
            actualCloseTime: shift.autoCloseTime,
          },
        });

        const snapshots = await tx.shiftSnapshot.findMany({
          where: { shiftId: shift.id },
          include: { menu: { select: { id: true, stock: true } } },
        });

        for (const snapshot of snapshots) {
          const currentStock = snapshot.menu.stock ?? 0;
          await tx.shiftSnapshot.update({
            where: { id: snapshot.id },
            data: { closingPlates: currentStock },
          });
        }

        return tx.shift.findUnique({
          where: { id: shift.id },
          include: {
            snapshots: { include: { menu: { select: { id: true, name: true } } } },
          },
        });
      });

      if (closed) {
        closedShifts.push(closed);
        console.log(
          `[scheduler] Auto-closed ${closed.type} shift ${closed.id} (scheduled close ${shift.autoCloseTime.toISOString()})`
        );
      }
    } catch (e) {
      console.error(`Error auto-closing shift ${shift.id}:`, e);
    }
  }

  return closedShifts;
}

let running = false;

export function startScheduler(intervalMs = 60_000) {
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const closedShifts = await autoCloseExpiredShifts();
      if (closedShifts.length > 0) {
        console.log(`[scheduler] Auto-closed ${closedShifts.length} shift(s)`);
      }
    } catch (e) {
      console.error("[scheduler] Auto-close tick failed:", e);
    } finally {
      running = false;
    }
  };

  void tick();
  const timer = setInterval(tick, intervalMs);

  return () => clearInterval(timer);
}
