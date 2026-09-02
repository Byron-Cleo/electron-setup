import prisma from "./db/db.js";

// Shift scheduler using an anchor-based operational cycle.
//
// The anchor shift is the active ShiftConfig with the EARLIEST autoOpenTime.
// operationDay is the anchor cycle's start date: the most recent anchor-open
// boundary (every anchorIntervalMinutes) at or before "now". All shifts that
// open inside the same cycle window share that one operationDay.
//
//   currentCycleStart = anchorToday - ceil((anchorToday - now) / interval) * interval
//   operationDay      = date(currentCycleStart)
//
// Shifts are created exactly at their autoOpenTime. A config whose open time
// fell inside an already-advanced cycle is reported as a missed shift and is NOT
// created retroactively — the business keeps running with the current cycle.
//
// Auto-close: every shift is auto-captured at its autoCloseTime. Configs with
// manual=false are also closed (finalCloseSource = "AUTO"); configs with
// manual=true stay open so the manager closes them later ("MANUAL").
// Midnight-crossing handled: if closeTime <= openTime, close is next-day.

const DEFAULT_INTERVAL_MINUTES = 1440;
const MISSED_SHIFT_LOG = new Map<string, Date>();

function occurrenceOf(time: string, day: Date): Date {
  const [h, m] = time.split(":").map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0);
}

function dateOnly(d: Date): Date {
  // Build as UTC midnight so Prisma's @db.Date stores the calendar date as-is
  // (local midnight in a +UTC zone would otherwise be written one day early).
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

export async function autoCreateShifts() {
  const now = new Date();
  const configs = await prisma.shiftConfig.findMany({
    where: { isActive: true },
    orderBy: { autoOpenTime: "asc" },
  });

  if (configs.length === 0) return;

  // Anchor = earliest autoOpenTime; its config defines the cycle window
  const anchor = configs[0];
  const intervalMs =
    (anchor.anchorIntervalMinutes > 0 ? anchor.anchorIntervalMinutes : DEFAULT_INTERVAL_MINUTES) * 60_000;

  const anchorToday = occurrenceOf(anchor.autoOpenTime, now);

  // Most recent anchor-open boundary at or before "now"
  let currentCycleStart: Date;
  if (now.getTime() >= anchorToday.getTime()) {
    currentCycleStart = anchorToday;
  } else {
    const behind = anchorToday.getTime() - now.getTime();
    const cyclesBehind = Math.ceil(behind / intervalMs);
    currentCycleStart = new Date(anchorToday.getTime() - cyclesBehind * intervalMs);
  }

  let operationDay = dateOnly(currentCycleStart);
  if (operationDay < dateOnly(now)) operationDay = dateOnly(now);

  for (const cfg of configs) {
    try {
      const openTime = occurrenceOf(cfg.autoOpenTime, now);
      const closeTime = occurrenceOf(cfg.autoCloseTime, now);
      if (closeTime.getTime() <= openTime.getTime()) {
        closeTime.setDate(closeTime.getDate() + 1);
      }

      // Missed: this config's open time belongs to a previous (advanced) cycle
      if (openTime.getTime() < currentCycleStart.getTime()) {
        const lastWarned = MISSED_SHIFT_LOG.get(cfg.type);
        if (!lastWarned || now.getTime() - lastWarned.getTime() > 5 * 60_000) {
          console.warn(
            `[scheduler] Missed shift "${cfg.type}" (open ${cfg.autoOpenTime} falls in a previous cycle). ` +
              `Orders stay blocked until a shift opens in the current cycle.`
          );
          MISSED_SHIFT_LOG.set(cfg.type, now);
        }
        continue;
      }

      // Not open yet — create exactly at autoOpenTime
      if (now.getTime() < openTime.getTime()) {
        continue;
      }

      await prisma.$transaction(async (tx) => {
        const existing = await tx.shift.findFirst({
          where: { type: cfg.type, operationDay },
        });
        if (existing) return;

        const shift = await tx.shift.create({
          data: {
            type: cfg.type,
            operationDay,
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

      console.log(
        `[scheduler] Auto-created ${cfg.type} shift for operational day ${operationDay.toISOString().split("T")[0]} (open ${cfg.autoOpenTime}, close ${cfg.autoCloseTime})`
      );
    } catch (e) {
      console.error(`[scheduler] Auto-create failed for ${cfg.type} (${cfg.autoOpenTime}):`, e);
    }
  }
}

// Auto-capture snapshot at scheduled close time.
// manual=false configs also close the shift (finalCloseSource="AUTO").
// manual=true configs keep isOpen=true so staff can manually close later.
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

  if (expiredShifts.length === 0) return [];

  const configs = await prisma.shiftConfig.findMany();
  const manualByType = new Map(configs.map((c) => [c.type, c.manual]));

  const autoClosedShifts: Awaited<ReturnType<typeof prisma.shift.findUnique>>[] = [];

  for (const shift of expiredShifts) {
    try {
      const manualClose =
        (manualByType.get(shift.type) ?? false) === true;

      const autoClosed = await prisma.$transaction(async (tx) => {
        // Always auto-capture at the scheduled close time
        await tx.shift.update({
          where: { id: shift.id },
          data: {
            autoClosed: true,
            autoClosedAt: now,
            isOpen: manualClose ? true : false,
            finalCloseSource: manualClose ? null : "AUTO",
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
          `[scheduler] Auto-captured ${autoClosed.type} shift ${autoClosed.id} at ${now.toISOString()} ` +
            `(scheduled ${shift.autoCloseTime.toISOString()}, manualClose=${manualClose})`
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