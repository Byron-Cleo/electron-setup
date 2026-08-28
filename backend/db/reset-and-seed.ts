import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, AccompanimentType, ItemUnit } from "./generated/prisma/client.js";
import sampleData from "./sample-data.js";

const connectionString = process.env.DATABASE_URL!;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log(
    "\nResetting DB: clearing all data EXCEPT Users, Departments, StockSupply...\n",
  );

  // Delete everything except User, Department, DepartmentStockSupply, StockSupply.
  // Children first (reverse-FK order) so constraints are never violated.
  const steps: [string, Promise<unknown>][] = [
    ["ShiftSnapshot", prisma.shiftSnapshot.deleteMany()],
    ["OrderItem", prisma.orderItem.deleteMany()],
    ["Order", prisma.order.deleteMany()],
    ["Shift", prisma.shift.deleteMany()],
    ["Cart", prisma.cart.deleteMany()],
    ["StockFulfillmentItem", prisma.stockFulfillmentItem.deleteMany()],
    ["StockFulfillment", prisma.stockFulfillment.deleteMany()],
    ["StockRequestItem", prisma.stockRequestItem.deleteMany()],
    ["StockRequest", prisma.stockRequest.deleteMany()],
    ["CookingRecordMenu", prisma.cookingRecordMenu.deleteMany()],
    ["CookingRecord", prisma.cookingRecord.deleteMany()],
    ["StockSupplyMenu", prisma.stockSupplyMenu.deleteMany()],
    ["Review", prisma.review.deleteMany()],
    ["MenuMealType", prisma.menuMealType.deleteMany()],
    ["Menu", prisma.menu.deleteMany()],
    ["MenuAccompaniment", prisma.menuAccompaniment.deleteMany()],
    ["Session", prisma.session.deleteMany()],
    ["Account", prisma.account.deleteMany()],
    ["VerificationToken", prisma.verificationToken.deleteMany()],
  ];

  for (const [name, query] of steps) {
    const result = await query;
    const count = (result as { count: number }).count;
    if (count > 0) console.log(`  Deleted ${count} ${name}`);
  }

  // Reset stock item quantities to 0 (fresh on-hand inventory).
  const stockResult = await prisma.stockSupply.updateMany({
    data: { currentStock: 0 },
  });
  console.log(`  Reset ${stockResult.count} StockSupply items (currentStock → 0)`);

  console.log("\nSeeding menu catalog (accompaniments, menus, meal types)...\n");

  // 1. Accompaniments first — Menu.starchId/vegetableId point here.
  await prisma.menuAccompaniment.createMany({
    data: sampleData.accompaniments.map((a) => ({
      ...a,
      category: a.category as AccompanimentType,
    })),
  });
  console.log("  Seeded accompaniments");

  // 2. Menus — references starchId/vegetableId (already in DB above).
  await prisma.menu.createMany({
    data: sampleData.menus.map((m) => ({ ...m, stock: 0 })),
  });
  console.log("  Seeded menus");

  // 3. MenuMealType last — menuId must already exist.
  await prisma.menuMealType.createMany({ data: sampleData.menuMealTypes });
  console.log("  Seeded menu meal type assignments");

  console.log(
    "\nDone! Users, Departments, Department↔Stock links, and StockSupply preserved; menu catalog reseeded.",
  );

  await pool.end();
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
