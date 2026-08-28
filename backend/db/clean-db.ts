import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL!;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Clearing transactional data (keeping Department, StockSupply, Menu, Users)...\n");

  // Delete in dependency order (children first)
  const steps: [string, Promise<unknown>][] = [
    ["ShiftSnapshot", prisma.shiftSnapshot.deleteMany()],
    ["OrderItem", prisma.orderItem.deleteMany()],
    ["Order", prisma.order.deleteMany()],
    ["Shift", prisma.shift.deleteMany()],
    ["Cart", prisma.cart.deleteMany()],
    ["CookingRecordMenu", prisma.cookingRecordMenu.deleteMany()],
    ["CookingRecord", prisma.cookingRecord.deleteMany()],
    ["Review", prisma.review.deleteMany()],
    ["Session", prisma.session.deleteMany()],
    ["Account", prisma.account.deleteMany()],
    ["VerificationToken", prisma.verificationToken.deleteMany()],
    ["StockFulfillmentItem", prisma.stockFulfillmentItem.deleteMany()],
    ["StockFulfillment", prisma.stockFulfillment.deleteMany()],
    ["StockRequestItem", prisma.stockRequestItem.deleteMany()],
    ["StockRequest", prisma.stockRequest.deleteMany()],
  ];

  for (const [name, query] of steps) {
    const result = await query;
    const count = (result as { count: number }).count;
    if (count > 0) console.log(`  Deleted ${count} ${name}`);
  }

  // Reset Menu.stock to 0 (clean slate for assignment flow)
  const menuResult = await prisma.menu.updateMany({
    data: { stock: 0, isAvailable: true },
  });
  console.log(`  Reset ${menuResult.count} Menu items (stock → 0, isAvailable → true)`);

  // Reset StockSupply.currentStock to 0
  const stockResult = await prisma.stockSupply.updateMany({
    data: { currentStock: 0 },
  });
  console.log(`  Reset ${stockResult.count} StockSupply items (currentStock → 0)`);

  console.log("\nDone! Database cleared. Department, StockSupply, Menu, Users, and relationships preserved.");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());