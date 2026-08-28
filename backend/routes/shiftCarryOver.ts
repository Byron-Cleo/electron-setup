import prisma from "../db/db.js";

export interface UnassignedBatch {
  cookingRecordId: string;
  stockSupplyId: string;
  stockSupplyName: string;
  totalProduced: number;
  totalAssigned: number;
  unassigned: number;
  menus: { menuId: string; menuName: string; platesAllocated: number }[];
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
  const windowEnd = nextShift?.openingTime ?? shift.autoCloseTime;

  const records = await prisma.cookingRecord.findMany({
    where: { createdAt: { gte: shift.openingTime, lt: windowEnd } },
    include: {
      stockSupply: { select: { id: true, name: true } },
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
    const unassigned = produced - totalAssigned;
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