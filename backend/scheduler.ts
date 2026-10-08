import prisma from "./db/db.js";
import { emitLiveEvent } from "./events.js";
import { recomputeMenuStock } from "./pools.js";

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

      const created = await prisma.$transaction(async (tx): Promise<string | null> => {
        const existing = await tx.shift.findFirst({
          where: { type: cfg.type, operationDay },
        });
        if (existing) return null;

        const shift = await tx.shift.create({
          data: {
            type: cfg.type,
            operationDay,
            autoOpenTime: openTime,
            autoCloseTime: closeTime,
            isOpen: true,
          },
        });

        // Opening stock ALWAYS comes from the live pool at creation. Menu.stock
        // is the recompute-maintained mirror of the true sellable pool, and the
        // live pool IS the handover from the immediately preceding shift —
        // whichever type it was — because every sale deducts from it in real
        // time. The old same-type carry (previous DAY→DAY / NIGHT→NIGHT
        // recorded closing) went stale whenever the other shift type sold
        // plates after that shift had already closed (e.g. a NIGHT sale at
        // 4:37AM after the previous DAY's close was stamped), so openings
        // never reconciled with live truth.
        const activeMenus = await tx.menu.findMany({
          where: { isAvailable: true },
          select: { id: true },
        });

        for (const menu of activeMenus) {
          // Heal the mirror before reading: SHARED pools can lag in Menu.stock
          // (cooking creates no splits), so recompute from the pool ledger to
          // snapshot the pool's true remainder at this exact moment.
          await recomputeMenuStock(tx, menu.id);
          const liveMenu = await tx.menu.findUnique({
            where: { id: menu.id },
            select: { stock: true },
          });

          await tx.shiftSnapshot.create({
            data: {
              shiftId: shift.id,
              menuId: menu.id,
              openingPlates: Number(liveMenu?.stock ?? 0),
              platesSold: 0,
              platesWasted: 0,
            },
          });
        }

        return shift.id;
      });

      if (created) {
        emitLiveEvent({
          type: "shift.opened",
          shiftId: created,
          at: new Date().toISOString(),
        });
        console.log(
          `[scheduler] Auto-created ${cfg.type} shift for operational day ${operationDay.toISOString().split("T")[0]} (open ${cfg.autoOpenTime}, close ${cfg.autoCloseTime})`
        );
      }
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
  const policyByType = new Map(configs.map((c) => [c.type, c]));

  const autoClosedShifts: Awaited<ReturnType<typeof prisma.shift.findUnique>>[] = [];

  for (const shift of expiredShifts) {
    try {
      // Strict-close manual shifts finalize at their scheduled close exactly
      // like auto shifts — they never sit open, so they take the full close
      // path below (isOpen=false, finalCloseSource="AUTO", unpaid acked).
      const cfg = policyByType.get(shift.type);
      const manualClose = cfg?.manual === true && cfg?.strictClose !== true;

      let markedUnpaidOrderIds: string[] = [];

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

        // A fully auto-closing shift has no manager to acknowledge its pending
        // orders, so the scheduler does it. Without this the orders stay
        // unpaidAcknowledged=false, which hides them from the Marked Unpaid
        // tabs and the unpaid badge while remaining blockingUnpaid forever on
        // an already-closed shift. Manual-close shifts are left alone: the
        // close gate still requires a manager to review them.
        if (!manualClose) {
          const pending = await tx.order.findMany({
            where: {
              shiftId: shift.id,
              isVoid: false,
              isPaid: false,
              unpaidAcknowledged: false,
            },
            select: { id: true },
          });

          if (pending.length > 0) {
            await tx.order.updateMany({
              where: { id: { in: pending.map((o) => o.id) } },
              data: {
                unpaidAcknowledged: true,
                unpaidAcknowledgedAt: now,
                unpaidAcknowledgedById: null,
              },
            });
            markedUnpaidOrderIds = pending.map((o) => o.id);
          }
        }

        // Heal the sellable mirror before snapshotting. `Menu.stock` can lag for
        // SHARED pools (cooking creates no splits), and the snapshot value is what
        // carries into the next shift's opening. Recompute from the pool ledger so
        // the pool's true remainder is carried forward — identical to the
        // manual-close path. Doing it here means even a fully automated close
        // (finalCloseSource=AUTO, no manual step) records the correct value.
        const snapshots = await tx.shiftSnapshot.findMany({
          where: { shiftId: shift.id },
          select: { id: true, menuId: true, platesSold: true },
        });
        for (const snapshot of snapshots) {
          await recomputeMenuStock(tx, snapshot.menuId);
        }
        for (const snapshot of snapshots) {
          const liveMenu = await tx.menu.findUnique({
            where: { id: snapshot.menuId },
            select: { stock: true },
          });
          const currentStock = Number(liveMenu?.stock ?? 0);
          await tx.shiftSnapshot.update({
            where: { id: snapshot.id },
            data: {
              closingStockAtAutoClose: currentStock,
              // Also stamp the carry-over value so a fully auto-closed shift
              // (which never runs the manual-close route) still feeds the next
              // shift's opening. A later manual close overwrites it.
              closingStockAtManualClose: currentStock,
              platesSoldAtAutoClose: snapshot.platesSold,
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
        if (!manualClose) {
          emitLiveEvent({
            type: "shift.closed",
            shiftId: autoClosed.id,
            at: new Date().toISOString(),
          });
          for (const orderId of markedUnpaidOrderIds) {
            emitLiveEvent({
              type: "order.unpaid-ack",
              orderId,
              shiftId: autoClosed.id,
              at: now.toISOString(),
            });
          }
        }
        console.log(
          `[scheduler] Auto-captured ${autoClosed.type} shift ${autoClosed.id} at ${now.toISOString()} ` +
            `(scheduled ${shift.autoCloseTime.toISOString()}, manualClose=${manualClose})` +
            (markedUnpaidOrderIds.length > 0
              ? ` · marked ${markedUnpaidOrderIds.length} pending order(s) unpaid`
              : "")
        );
      }
    } catch (e) {
      console.error(`Error auto-capturing shift ${shift.id}:`, e);
    }
  }

  return autoClosedShifts;
}

// Force-close manual shifts that passed their allowed drift limit. The close
// is stamped AT THE DEADLINE (autoCloseTime + maxDriftMinutes), not at the
// tick moment, so report attribution stays deterministic even if the
// scheduler was down. Unlimited (maxDriftMinutes=null) shifts are never
// forced — that is the legacy red-flag default. The manager can always
// close manually before the deadline; the limit is a maximum, not a delay.
export async function forceCloseOverdueShifts(now = new Date()) {
  const driftingShifts = await prisma.shift.findMany({
    where: {
      isOpen: true,
      autoClosed: true,
      finalCloseSource: null,
    },
  });

  if (driftingShifts.length === 0) return [];

  const configs = await prisma.shiftConfig.findMany();
  const policyByType = new Map(configs.map((c) => [c.type, c]));

  const forcedShifts: Awaited<ReturnType<typeof prisma.shift.findUnique>>[] = [];

  for (const shift of driftingShifts) {
    try {
      const cfg = policyByType.get(shift.type);
      if (cfg?.manual !== true) continue; // auto or unknown config: never forced
      if (cfg.strictClose) continue; // strict shifts closed fully at auto-capture
      const maxDrift = cfg.maxDriftMinutes;
      if (maxDrift === null || maxDrift === undefined) continue; // unlimited — legacy default

      const deadline = new Date(shift.autoCloseTime.getTime() + maxDrift * 60_000);
      if (now.getTime() < deadline.getTime()) continue; // still inside its allowed drift

      let acknowledgedOrderIds: string[] = [];

      const closed = await prisma.$transaction(async (tx) => {
        await tx.shift.update({
          where: { id: shift.id },
          data: {
            isOpen: false,
            finalClosedAt: deadline,
            finalCloseSource: "FORCED",
          },
        });

        // A forced close has no manager to review pending orders, so the
        // scheduler acknowledges them — same rule as the auto-close path.
        const pending = await tx.order.findMany({
          where: {
            shiftId: shift.id,
            isVoid: false,
            isPaid: false,
            unpaidAcknowledged: false,
          },
          select: { id: true },
        });
        if (pending.length > 0) {
          await tx.order.updateMany({
            where: { id: { in: pending.map((o) => o.id) } },
            data: {
              unpaidAcknowledged: true,
              unpaidAcknowledgedAt: now,
              unpaidAcknowledgedById: null,
            },
          });
          acknowledgedOrderIds = pending.map((o) => o.id);
        }

        // Closing snapshot: heal the sellable mirror first (SHARED pools lag
        // in Menu.stock), then stamp the carry-over value — identical to the
        // manual-close path, so the next shift's opening stays correct.
        const snapshots = await tx.shiftSnapshot.findMany({
          where: { shiftId: shift.id },
          select: { id: true, menuId: true, closingStockAtAutoClose: true },
        });
        for (const snapshot of snapshots) {
          await recomputeMenuStock(tx, snapshot.menuId);
        }
        for (const snapshot of snapshots) {
          const liveMenu = await tx.menu.findUnique({
            where: { id: snapshot.menuId },
            select: { stock: true },
          });
          const currentStock = Number(liveMenu?.stock ?? 0);
          const autoPlates =
            snapshot.closingStockAtAutoClose === null
              ? null
              : Number(snapshot.closingStockAtAutoClose);
          await tx.shiftSnapshot.update({
            where: { id: snapshot.id },
            data: {
              closingStockAtManualClose: currentStock,
              manualCloseTime: deadline,
              driftPlates: autoPlates !== null ? currentStock - autoPlates : null,
              driftMinutes: maxDrift,
            },
          });
        }

        return tx.shift.findUnique({ where: { id: shift.id } });
      });

      if (closed) {
        forcedShifts.push(closed);
        emitLiveEvent({
          type: "shift.closed",
          shiftId: closed.id,
          at: new Date().toISOString(),
        });
        for (const orderId of acknowledgedOrderIds) {
          emitLiveEvent({
            type: "order.unpaid-ack",
            orderId,
            shiftId: closed.id,
            at: now.toISOString(),
          });
        }
        console.log(
          `[scheduler] Force-closed ${closed.type} shift ${closed.id} at drift deadline ${deadline.toISOString()} ` +
            `(scheduled close ${shift.autoCloseTime.toISOString()}, max drift ${maxDrift}min)` +
            (acknowledgedOrderIds.length > 0
              ? ` · marked ${acknowledgedOrderIds.length} pending order(s) unpaid`
              : "")
        );
      }
    } catch (e) {
      console.error(`Error force-closing shift ${shift.id}:`, e);
    }
  }

  return forcedShifts;
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
      await forceCloseOverdueShifts();
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