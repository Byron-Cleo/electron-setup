const connectionString =
  process.env.DATABASE_URL || "postgresql://mac@localhost:5432/eraevadb";

// This script deletes orders, order items, shifts and shift snapshots for real.
// It now defaults to the live development database (eraevadb), so refuse to run
// unless the caller opts in explicitly. Imports are deferred past the guard so
// the refusal works even without the Prisma client generated.
if (!process.argv.includes("--yes") && process.env.CONFIRM !== "1") {
  console.error(
    `Refusing to run: this deletes operational data from ${connectionString}.\n` +
      "Re-run with:  npx tsx clear-test-db.mjs --yes",
  );
  process.exit(1);
}

const { PrismaClient } = await import("./db/generated/prisma/client.js");
const { PrismaPg } = await import("@prisma/adapter-pg");
const pg = (await import("pg")).default;

const prisma = new PrismaClient({
  adapter: new PrismaPg(new pg({ connectionString })),
});
await prisma.shiftSnapshot.deleteMany({});
await prisma.orderItem.deleteMany({});
await prisma.order.deleteMany({});
await prisma.shift.deleteMany({});
console.log(
  `DB cleared (${connectionString}): ShiftSnapshot, OrderItem, Order, Shift only. Menu/CookingRecord preserved.`,
);
await prisma.$disconnect();
