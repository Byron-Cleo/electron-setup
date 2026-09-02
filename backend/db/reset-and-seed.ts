import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL!;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log(
    "\nResetting DB: clearing all data EXCEPT Users, Departments, StockSupply, and the menu catalog...\n",
  );

  // Transactional/reset data only. Users, Departments, StockSupply, and the
  // menu catalog (Menu, MenuAccompaniment, MenuMealType, StockSupplyMenu) are
  // PRESERVED — only cleared data that is safe to wipe.
  // Children first (reverse-FK order) so constraints are never violated.
  const steps: [string, Promise<unknown>][] = [
    ["ShiftSnapshot", prisma.shiftSnapshot.deleteMany()],
    ["OrderItem", prisma.orderItem.deleteMany()],
    ["Order", prisma.order.deleteMany()],
    ["Shift", prisma.shift.deleteMany()],
    ["ShiftConfig", prisma.shiftConfig.deleteMany()],
    ["Cart", prisma.cart.deleteMany()],
    ["StockFulfillmentItem", prisma.stockFulfillmentItem.deleteMany()],
    ["StockFulfillment", prisma.stockFulfillment.deleteMany()],
    ["StockRequestItem", prisma.stockRequestItem.deleteMany()],
    ["StockRequest", prisma.stockRequest.deleteMany()],
    ["CookingRecordMenu", prisma.cookingRecordMenu.deleteMany()],
    ["CookingRecord", prisma.cookingRecord.deleteMany()],
    ["Review", prisma.review.deleteMany()],
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

  console.log(
    "\nDone! Users, Departments, Department↔Stock links, StockSupply, and the menu catalog preserved; transactional data cleared.",
  );

  await pool.end();
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
