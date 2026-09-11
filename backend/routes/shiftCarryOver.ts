import prisma from "../db/db.js";

export interface UnassignedBatch {
  cookingRecordId: string;
  stockSupplyId: string;
  stockSupplyName: string;
  totalProduced: number;
  totalAssigned: number;
  unassigned: number;
  menus: { menuId: string; menuName: string; platesAllocated: number; platesSold: number }[];
}

// A batch with full operation-date attribution. `validUnassigned` is the amount
// assignable in the current window — 0 for batches from a previous operation date.
export interface OperationDateUnassignedBatch extends UnassignedBatch {
  expired: boolean;
  validUnassigned: number;
  // Plates from this batch now sitting on menus (allocated − sold).
  sellingNow: number;
  // Plates sold from this batch's assigned/selling portion.
  soldTotal: number;
  cookedAt: string;
  shiftId: string | null;
  shiftType: string | null;
  operationDay: string | null;
  autoOpenTime: string | null;
  autoCloseTime: string | null;
  // Menu ids this batch's stock item can be assigned to (from stockSupply.menus).
  linkableMenus: string[];
}

export interface OperationCycle {
  cycleStart: Date;
  cycleEnd: Date;
  operationDay: Date;
  // Minutes-from-midnight of the day shift anchor (e.g. 330 = 05:30) and the
  // anchor interval in minutes — used to attribute any timestamp deterministically.
  dayStartMinutes: number;
  intervalMinutes: number;
}

// The operation date = one day shift + one night shift, anchored to the earliest
// active config's autoOpenTime across an anchor interval (default 24h). Mirrors
// the scheduler's anchor math so the UI and the scheduler share one boundary.
export async function computeCurrentCycle(): Promise<OperationCycle | null> {
  const configs = await prisma.shiftConfig.findMany({
    where: { isActive: true },
    orderBy: { autoOpenTime: "asc" },
  });
  if (configs.length === 0) return null;

  const anchor = configs[0];
  const intervalMinutes = anchor.anchorIntervalMinutes > 0 ? anchor.anchorIntervalMinutes : DEFAULT_INTERVAL_MINUTES;
  const now = new Date();
  const anchorToday = occurrenceOf(anchor.autoOpenTime, now);

  let cycleStart: Date;
  if (now.getTime() >= anchorToday.getTime()) {
    cycleStart = anchorToday;
  } else {
    const behind = anchorToday.getTime() - now.getTime();
    const cyclesBehind = Math.ceil(behind / (intervalMinutes * 60_000));
    cycleStart = new Date(anchorToday.getTime() - cyclesBehind * intervalMinutes * 60_000);
  }

  return {
    cycleStart,
    cycleEnd: new Date(cycleStart.getTime() + intervalMinutes * 60_000),
    operationDay: dateOnly(cycleStart),
    dayStartMinutes: timeToMinutes(anchor.autoOpenTime),
    intervalMinutes,
  };
}

const DEFAULT_INTERVAL_MINUTES = 1440;

function occurrenceOf(time: string, day: Date): Date {
  const [h, m] = time.split(":").map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0);
}

function timeToMinutes(time: string | Date): number {
  if (typeof time === "string") {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  }
  return time.getHours() * 60 + time.getMinutes();
}

function dateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

export interface ClockAttribution {
  shiftType: "DAY" | "NIGHT";
  operationDay: Date;
  autoOpenTime: Date;
  autoCloseTime: Date;
}

// Pure clock-based attribution matching the operation-date model: the 24h cycle
// opens at the day anchor (e.g. 05:30), the first 12h are the DAY shift, the
// next 12h (17:30 → next 05:30) are the NIGHT shift. Works even when no Shift
// row exists for the window — ideal for backfilling or displaying history.
export function attributeByClock(
  createdAt: Date,
  dayStartMinutes: number,
  intervalMinutes: number
): ClockAttribution {
  const intervalMs = intervalMinutes * 60_000;
  const anchorToday = occurrenceOf(
    `${String(Math.floor(dayStartMinutes / 60)).padStart(2, "0")}:${String(dayStartMinutes % 60).padStart(2, "0")}`,
    createdAt
  );
  let cycleStart: Date;
  if (createdAt.getTime() >= anchorToday.getTime()) {
    cycleStart = anchorToday;
  } else {
    const behind = anchorToday.getTime() - createdAt.getTime();
    const cyclesBehind = Math.ceil(behind / intervalMs);
    cycleStart = new Date(anchorToday.getTime() - cyclesBehind * intervalMs);
  }
  const m = createdAt.getHours() * 60 + createdAt.getMinutes();
  const shiftType: "DAY" | "NIGHT" =
    m >= dayStartMinutes && m < dayStartMinutes + DEFAULT_SHIFT_HOURS * 60 ? "DAY" : "NIGHT";
  const dayStart = occurrenceOf(
    `${String(Math.floor(dayStartMinutes / 60)).padStart(2, "0")}:${String(dayStartMinutes % 60).padStart(2, "0")}`,
    cycleStart
  );
  const autoOpenTime = new Date(dayStart.getTime() + (shiftType === "NIGHT" ? DEFAULT_SHIFT_HOURS * 60 * 60_000 : 0));
  const autoCloseTime = new Date(dayStart.getTime() + intervalMs - 60_000);
  return { shiftType, operationDay: dateOnly(cycleStart), autoOpenTime, autoCloseTime };
}

const DEFAULT_SHIFT_HOURS = 12;

// Resolve the shift whose [autoOpenTime, nextShift.autoOpenTime ?? autoCloseTime)
// window contains `date` — the timing is already stored on the shift rows. Used
// when recording a cooking batch so every record is attributed to a shift at rest.
export async function findShiftIdForTime(date: Date): Promise<string | null> {
  const shift = await prisma.shift.findFirst({
    where: { autoOpenTime: { lte: date } },
    orderBy: { autoOpenTime: "desc" },
    select: { id: true, autoOpenTime: true, autoCloseTime: true },
  });
  if (!shift) return null;
  const nextShift = await prisma.shift.findFirst({
    where: { autoOpenTime: { gt: shift.autoOpenTime } },
    orderBy: { autoOpenTime: "asc" },
    select: { autoOpenTime: true },
  });
  const windowEnd = nextShift?.autoOpenTime ?? shift.autoCloseTime;
  return date.getTime() < windowEnd.getTime() ? shift.id : null;
}

interface SoldByMenuMap {
  soldByMenu: Map<string, number>;
}

async function soldByMenuForShiftWhere(where: object): Promise<Map<string, number>> {
  const snapshots = await prisma.shiftSnapshot.findMany({
    where,
    select: { menuId: true, platesSold: true },
  });
  const soldByMenu = new Map<string, number>();
  for (const snap of snapshots) {
    soldByMenu.set(snap.menuId, (soldByMenu.get(snap.menuId) ?? 0) + Number(snap.platesSold));
  }
  return soldByMenu;
}

interface StoredShiftAttribution {
  shift: {
    id: string;
    type: string;
    operationDay: Date;
    autoOpenTime: Date;
    autoCloseTime: Date;
  } | null;
  createdAt: Date;
}

// Prefer the persisted shiftId (set at cook time from the shift's timing), falling
// back to the deterministic clock rule when a window has no shift row yet.
function attributionForCookingRecord(
  record: StoredShiftAttribution,
  cycle: OperationCycle
): {
  shiftId: string | null;
  shiftType: string | null;
  operationDay: string | null;
  autoOpenTime: string | null;
  autoCloseTime: string | null;
} {
  if (record.shift) {
    return {
      shiftId: record.shift.id,
      shiftType: record.shift.type,
      operationDay: dateOnly(record.shift.operationDay).toISOString().slice(0, 10),
      autoOpenTime: record.shift.autoOpenTime.toISOString(),
      autoCloseTime: record.shift.autoCloseTime.toISOString(),
    };
  }
  const clock = attributeByClock(record.createdAt, cycle.dayStartMinutes, cycle.intervalMinutes);
  return {
    shiftId: null,
    shiftType: clock.shiftType,
    operationDay: dateOnly(clock.operationDay).toISOString().slice(0, 10),
    autoOpenTime: clock.autoOpenTime.toISOString(),
    autoCloseTime: clock.autoCloseTime.toISOString(),
  };
}

// Unassigned production from the CURRENT operation-date window (day + night), with
// full attribution. These are the plates that can still be assigned this window.
export async function computeAllUnassignedBatches(
  cycle: OperationCycle
): Promise<{ batches: OperationDateUnassignedBatch[] }> {
  const soldByMenu = await soldByMenuForShiftWhere({ shift: { autoOpenTime: { gte: cycle.cycleStart, lt: cycle.cycleEnd } } });

  const records = await prisma.cookingRecord.findMany({
    where: { createdAt: { gte: cycle.cycleStart, lt: cycle.cycleEnd }, disposed: false },
    include: {
      stockSupply: { select: { id: true, name: true, menus: { select: { menuId: true } } } },
      cookingRecordMenus: {
        include: { menu: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
      shift: { select: { id: true, type: true, operationDay: true, autoOpenTime: true, autoCloseTime: true } },
    },
  });

  const batches: OperationDateUnassignedBatch[] = [];
  for (const record of records) {
    const produced = Number(record.platesActual ?? record.platesExpected);
    const remainingTotal = record.cookingRecordMenus.reduce((sum, crm) => sum + Number(crm.platesRemaining), 0);
    const batchSold = record.stockSupply.menus.reduce((sum, sm) => sum + (soldByMenu.get(sm.menuId) ?? 0), 0);
    const unassigned = produced - remainingTotal - batchSold;
    if (unassigned <= 0) continue;

    const attribution = attributionForCookingRecord(record, cycle);

    batches.push({
      cookingRecordId: record.id,
      stockSupplyId: record.stockSupplyId,
      stockSupplyName: record.stockSupply.name,
      totalProduced: produced,
      totalAssigned: record.cookingRecordMenus.reduce((sum, crm) => sum + Number(crm.platesAllocated), 0),
      unassigned,
      expired: false,
      validUnassigned: unassigned,
      sellingNow: produced - batchSold - unassigned,
      soldTotal: batchSold,
      cookedAt: record.createdAt.toISOString(),
      shiftId: attribution.shiftId,
      shiftType: attribution.shiftType,
      operationDay: attribution.operationDay,
      autoOpenTime: attribution.autoOpenTime,
      autoCloseTime: attribution.autoCloseTime,
      linkableMenus: record.stockSupply.menus.map((m) => m.menuId),
      menus: record.cookingRecordMenus.map((crm) => ({
        menuId: crm.menu.id,
        menuName: crm.menu.name,
        platesAllocated: Number(crm.platesAllocated),
        platesSold: soldByMenu.get(crm.menu.id) ?? 0,
      })),
    });
  }

  batches.sort((a, b) => b.unassigned - a.unassigned);
  return { batches };
}

// Unassigned production from BEFORE the current operation date that was never
// handled. These read validUnassigned = 0 (fresh food must be cooked) but keep
// their full attribution so a manager can still choose to carry them over or
// mark them as wasted.
export async function computeExpiredUnassignedBatches(
  cycle: OperationCycle
): Promise<{ batches: OperationDateUnassignedBatch[] }> {
  const soldByMenu = await soldByMenuForShiftWhere({ shift: { autoOpenTime: { lt: cycle.cycleStart } } });

  const records = await prisma.cookingRecord.findMany({
    where: { createdAt: { lt: cycle.cycleStart }, disposed: false },
    include: {
      stockSupply: { select: { id: true, name: true, menus: { select: { menuId: true } } } },
      cookingRecordMenus: {
        include: { menu: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
      shift: { select: { id: true, type: true, operationDay: true, autoOpenTime: true, autoCloseTime: true } },
    },
  });

  const batches: OperationDateUnassignedBatch[] = [];
  for (const record of records) {
    const produced = Number(record.platesActual ?? record.platesExpected);
    const remainingTotal = record.cookingRecordMenus.reduce((sum, crm) => sum + Number(crm.platesRemaining), 0);
    const batchSold = record.stockSupply.menus.reduce((sum, sm) => sum + (soldByMenu.get(sm.menuId) ?? 0), 0);
    const unassigned = produced - remainingTotal - batchSold;
    if (unassigned <= 0) continue;

    const attribution = attributionForCookingRecord(record, cycle);

    batches.push({
      cookingRecordId: record.id,
      stockSupplyId: record.stockSupplyId,
      stockSupplyName: record.stockSupply.name,
      totalProduced: produced,
      totalAssigned: record.cookingRecordMenus.reduce((sum, crm) => sum + Number(crm.platesAllocated), 0),
      unassigned,
      expired: true,
      validUnassigned: 0,
      sellingNow: produced - batchSold - unassigned,
      soldTotal: batchSold,
      cookedAt: record.createdAt.toISOString(),
      shiftId: attribution.shiftId,
      shiftType: attribution.shiftType,
      operationDay: attribution.operationDay,
      autoOpenTime: attribution.autoOpenTime,
      autoCloseTime: attribution.autoCloseTime,
      linkableMenus: record.stockSupply.menus.map((m) => m.menuId),
      menus: record.cookingRecordMenus.map((crm) => ({
        menuId: crm.menu.id,
        menuName: crm.menu.name,
        platesAllocated: Number(crm.platesAllocated),
        platesSold: soldByMenu.get(crm.menu.id) ?? 0,
      })),
    });
  }

  batches.sort((a, b) => b.unassigned - a.unassigned);
  return { batches };
}

// Wasted (disposed) cooking batches. Attribution is kept to the operation date
// the batch was PRODUCED (persisted shiftId or clock fallback) — the waste
// belongs to that production op-date in the final report, regardless of when
// the Waste action happened. Wasted qty = the batch's unassigned plates
// (produced minus what was ever allocated to menus); assigned/sold plates were
// already accounted for on the menus.
export interface WastedStockBatch {
  cookingRecordId: string;
  stockSupplyId: string;
  stockSupplyName: string;
  totalProduced: number;
  totalAssigned: number;
  soldTotal: number;
  wastedQty: number;
  cookedAt: string;
  disposedAt: string;
  shiftId: string | null;
  shiftType: string | null;
  operationDay: string | null;
  autoOpenTime: string | null;
  autoCloseTime: string | null;
}

export async function computeWastedBatches(
  cycle: OperationCycle | null
): Promise<{ batches: WastedStockBatch[] }> {
  const soldByMenu = await soldByMenuForShiftWhere({});

  const records = await prisma.cookingRecord.findMany({
    where: { disposed: true },
    include: {
      stockSupply: { select: { id: true, name: true, menus: { select: { menuId: true } } } },
      cookingRecordMenus: {
        include: { menu: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
      shift: { select: { id: true, type: true, operationDay: true, autoOpenTime: true, autoCloseTime: true } },
    },
  });

  const batches: WastedStockBatch[] = [];
  for (const record of records) {
    const produced = Number(record.platesActual ?? record.platesExpected);
    const batchSold = record.stockSupply.menus.reduce((sum, sm) => sum + (soldByMenu.get(sm.menuId) ?? 0), 0);
    const totalAssigned = record.cookingRecordMenus.reduce((sum, crm) => sum + Number(crm.platesAllocated), 0);
    const wastedQty = produced - totalAssigned;
    if (wastedQty <= 0) continue;

    let shiftType: string | null = null;
    let operationDay: string | null = null;
    let autoOpenTime: string | null = null;
    let autoCloseTime: string | null = null;
    if (record.shift) {
      shiftType = record.shift.type;
      operationDay = dateOnly(record.shift.operationDay).toISOString().slice(0, 10);
      autoOpenTime = record.shift.autoOpenTime.toISOString();
      autoCloseTime = record.shift.autoCloseTime.toISOString();
    } else if (cycle !== null) {
      const clock = attributeByClock(record.createdAt, cycle.dayStartMinutes, cycle.intervalMinutes);
      shiftType = clock.shiftType;
      operationDay = dateOnly(clock.operationDay).toISOString().slice(0, 10);
      autoOpenTime = clock.autoOpenTime.toISOString();
      autoCloseTime = clock.autoCloseTime.toISOString();
    }

    batches.push({
      cookingRecordId: record.id,
      stockSupplyId: record.stockSupplyId,
      stockSupplyName: record.stockSupply.name,
      totalProduced: produced,
      totalAssigned,
      soldTotal: batchSold,
      wastedQty,
      cookedAt: record.createdAt.toISOString(),
      disposedAt: record.disposedAt ? record.disposedAt.toISOString() : record.createdAt.toISOString(),
      shiftId: record.shift?.id ?? null,
      shiftType,
      operationDay,
      autoOpenTime,
      autoCloseTime,
    });
  }

  batches.sort((a, b) => (a.disposedAt < b.disposedAt ? 1 : -1));
  return { batches };
}
// starts before a given time (used to find the shift immediately preceding
// another shift).
export async function findPreviousClosedShift(before?: Date) {
  return prisma.shift.findFirst({
    where: {
      isOpen: false,
      ...(before ? { autoOpenTime: { lt: before } } : {}),
    },
    orderBy: { autoOpenTime: "desc" },
    include: {
      snapshots: {
        include: {
          menu: {
            select: {
              id: true,
              name: true,
              stockSupplyMenus: {
                include: { stockSupply: { select: { id: true, name: true } } },
              },
            },
          },
        },
      },
    },
  });
}

// Compute the unassigned production from a shift's cooking records.
// A batch is "unassigned" when its produced plates (actual/expected) exceed
// the plates allocated via its CookingRecordMenu splits.
export async function computeShiftUnassignedBatches(shift: {
  id: string;
  autoOpenTime: Date;
  autoCloseTime: Date;
  createdAt: Date;
  operationDay: Date;
  autoClosedAt: Date | null;
}): Promise<{
  windowEnd: Date;
  batches: UnassignedBatch[];
  total: number;
}> {
  const nextShift = await prisma.shift.findFirst({
    where: { autoOpenTime: { gt: shift.autoOpenTime }, operationDay: shift.operationDay },
    orderBy: { autoOpenTime: "asc" },
    select: { autoOpenTime: true },
  });
  const windowStart = shift.createdAt ?? shift.autoOpenTime;
  const windowEnd = nextShift?.autoOpenTime ?? shift.autoClosedAt ?? shift.autoCloseTime;

  // Sold is captured per menu in this shift's snapshots. Unassigned must
  // replicate the AssignmentModal's Remaining Pool exactly: produced minus the
  // plates still on menus (Σ platesRemaining) minus the plates sold. Using
  // platesAllocated here would include sold plates (allocated = remaining +
  // sold) and subtract them twice.
  const shiftSnapshots = await prisma.shiftSnapshot.findMany({
    where: { shiftId: shift.id },
    select: { menuId: true, platesSold: true },
  });
  const soldByMenu = new Map<string, number>();
  for (const snap of shiftSnapshots) {
    soldByMenu.set(snap.menuId, (soldByMenu.get(snap.menuId) ?? 0) + Number(snap.platesSold));
  }

  const records = await prisma.cookingRecord.findMany({
    where: { createdAt: { gte: windowStart, lt: windowEnd } },
    include: {
      stockSupply: {
        select: {
          id: true,
          name: true,
          menus: { select: { menuId: true } },
        },
      },
      cookingRecordMenus: {
        include: { menu: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const batches: UnassignedBatch[] = [];
  for (const record of records) {
    const produced = Number(record.platesActual ?? record.platesExpected);
    const totalAssigned = record.cookingRecordMenus.reduce(
      (sum, crm) => sum + Number(crm.platesAllocated),
      0
    );
    const remainingTotal = record.cookingRecordMenus.reduce(
      (sum, crm) => sum + Number(crm.platesRemaining),
      0
    );
    const batchSold = record.stockSupply.menus.reduce(
      (sum, sm) => sum + (soldByMenu.get(sm.menuId) ?? 0),
      0
    );
    const unassigned = produced - remainingTotal - batchSold;
    if (unassigned <= 0) continue;
    batches.push({
      cookingRecordId: record.id,
      stockSupplyId: record.stockSupplyId,
      stockSupplyName: record.stockSupply.name,
      totalProduced: produced,
      totalAssigned,
      unassigned,
      menus: record.cookingRecordMenus.map((crm) => ({
        menuId: crm.menu.id,
        menuName: crm.menu.name,
        platesAllocated: Number(crm.platesAllocated),
        platesSold: soldByMenu.get(crm.menu.id) ?? 0,
      })),
    });
  }

  batches.sort((a, b) => b.unassigned - a.unassigned);

  return {
    windowEnd,
    batches,
    total: batches.reduce((sum, b) => sum + b.unassigned, 0),
  };
}