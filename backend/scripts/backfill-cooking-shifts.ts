import "dotenv/config";
import prisma from "../db/db.js";

// One-off backfill: assign shiftId to existing cooking records whose timing falls
// inside a shift's [autoOpenTime, nextShift.autoOpenTime ?? autoCloseTime) window.
// Run with: npx tsx scripts/backfill-cooking-shifts.ts
async function main() {
  const shifts = await prisma.shift.findMany({
    orderBy: { autoOpenTime: "asc" },
    select: { id: true, autoOpenTime: true, autoCloseTime: true },
  });
  if (shifts.length === 0) {
    console.log("No shifts exist — nothing to backfill.");
    return;
  }

  const records = await prisma.cookingRecord.findMany({
    where: { shiftId: null },
    select: { id: true, createdAt: true },
  });
  console.log(`Cooking records without shiftId: ${records.length}`);

  let assigned = 0;
  for (const record of records) {
    let shiftId: string | null = null;
    for (let i = 0; i < shifts.length; i++) {
      const shift = shifts[i];
      const windowEnd = shifts[i + 1]?.autoOpenTime ?? shift.autoCloseTime;
      if (record.createdAt.getTime() >= shift.autoOpenTime.getTime() && record.createdAt.getTime() < windowEnd.getTime()) {
        shiftId = shift.id;
        break;
      }
    }
    if (!shiftId) {
      const last = shifts[shifts.length - 1];
      if (record.createdAt.getTime() >= last.autoOpenTime.getTime()) shiftId = last.id;
    }
    if (!shiftId) continue;

    await prisma.cookingRecord.update({ where: { id: record.id }, data: { shiftId } });
    assigned++;
  }

  console.log(`Assigned shiftId to ${assigned} record(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());