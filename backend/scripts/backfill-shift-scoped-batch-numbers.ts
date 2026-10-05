import "dotenv/config";
import prisma from "../db/db.js";

// One-off backfill: assign batch numbers per stockSupplyId and shiftId ordered by createdAt ASC
async function main() {
  const supplies = await prisma.stockSupply.findMany({
    where: { isMenuStock: true },
    select: { id: true }
  });

  console.log(`Processing ${supplies.length} stock supplies...`);
  let totalUpdated = 0;

  for (const supply of supplies) {
    const shiftsWithRecords = await prisma.cookingRecord.findMany({
      where: { stockSupplyId: supply.id, shiftId: { not: null } },
      select: { shiftId: true },
      distinct: ['shiftId']
    });

    for (const shift of shiftsWithRecords) {
      if (!shift.shiftId) continue;
      const records = await prisma.cookingRecord.findMany({
        where: { stockSupplyId: supply.id, shiftId: shift.shiftId },
        orderBy: { createdAt: "asc" },
        select: { id: true }
      });

      for (let i = 0; i < records.length; i++) {
        await prisma.cookingRecord.update({
          where: { id: records[i].id },
          data: { batchNumber: i + 1 }
        });
      }
      totalUpdated += records.length;
    }

    // Handle records with no shiftId
    const nullShiftRecords = await prisma.cookingRecord.findMany({
      where: { stockSupplyId: supply.id, shiftId: null },
      orderBy: { createdAt: "asc" },
      select: { id: true }
    });

    if (nullShiftRecords.length > 0) {
      for (let i = 0; i < nullShiftRecords.length; i++) {
        await prisma.cookingRecord.update({
          where: { id: nullShiftRecords[i].id },
          data: { batchNumber: i + 1 }
        });
      }
      totalUpdated += nullShiftRecords.length;
    }
  }
  console.log(`Assigned batch numbers to ${totalUpdated} cooking records.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
