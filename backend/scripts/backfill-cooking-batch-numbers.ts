import "dotenv/config";
import prisma from "../db/db.js";

// One-off backfill: assign batch numbers per stockSupplyId ordered by createdAt ASC
async function main() {
  const supplies = await prisma.stockSupply.findMany({
    where: { isMenuStock: true },
    select: { id: true }
  });

  console.log(`Processing ${supplies.length} stock supplies...`);
  let totalUpdated = 0;
  for (const supply of supplies) {
    const records = await prisma.cookingRecord.findMany({
      where: { stockSupplyId: supply.id },
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
  console.log(`Assigned batch numbers to ${totalUpdated} cooking records.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
