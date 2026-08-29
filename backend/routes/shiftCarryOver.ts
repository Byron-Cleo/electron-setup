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

// Find the most recent closed shift, optionally scoped to those whose window
// starts before a given time (used to find the shift immediately preceding
// another shift).
export async function findPreviousClosedShift(before?: Date) {
  return prisma.shift.findFirst({
    where: {
      isOpen: false,
      ...(before ? { openingTime: { lt: before } } : {}),
    },
    orderBy: { openingTime: "desc" },
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
  openingTime: Date;
  autoCloseTime: Date;
  actualOpeningTime: Date | null;
  actualCloseTime: Date | null;
  date: Date;
}): Promise<{
  windowEnd: Date;
  batches: UnassignedBatch[];
  total: number;
}> {
  const nextShift = await prisma.shift.findFirst({
    where: { openingTime: { gt: shift.openingTime }, date: shift.date },
    orderBy: { openingTime: "asc" },
    select: { openingTime: true },
  });
  // Use the shift's ACTUAL open/close as the batch window when available, so
  // anything cooked while the shift was really running counts toward it.
  const windowStart = shift.actualOpeningTime ?? shift.openingTime;
  const windowEnd = nextShift?.openingTime ?? shift.actualCloseTime ?? shift.autoCloseTime;

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