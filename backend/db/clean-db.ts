import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";
import { recomputeMenuStock } from "./pools.js";
import readline from "node:readline";

const connectionString = process.env.DATABASE_URL!;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

function prompt(q: string): Promise<string> {
  return new Promise((resolve) => rl.question(q + " ", (a) => resolve(a.trim())));
}

async function main() {
  console.log("=== Eraeva pre-shift wipe ===");

  const { rows: [dbRow] } = await pool.query<{ db: string }>("SELECT current_database() AS db");
  const dbName = String(dbRow.db);
  console.log(`Target database: ${dbName}`);
  if (dbName !== "eraevadb") {
    console.error(`Refusing: expected database "eraevadb", found "${dbName}".`);
    process.exit(1);
  }

  const pre = await pool.query<{
    orders: string;
    order_items: string;
    allocations: string;
    cooking_records: string;
    stock_requests: string;
    fulfillments: string;
    returns: string;
    snapshots: string;
    shifts: string;
    carts: string;
    reviews: string;
    sessions: string;
    accounts: string;
    verification_tokens: string;
    stock_adjustments: string;
    max_order_no: string;
    menus: string;
    supplies: string;
    customers: string;
    users: string;
  }>(`
    SELECT
      (SELECT count(*) FROM "Order") AS orders,
      (SELECT count(*) FROM "OrderItem") AS order_items,
      (SELECT count(*) FROM "OrderItemAllocation") AS allocations,
      (SELECT count(*) FROM "CookingRecord") AS cooking_records,
      (SELECT count(*) FROM "StockRequest") AS stock_requests,
      (SELECT count(*) FROM "StockFulfillment") AS fulfillments,
      (SELECT count(*) FROM "StockReturn") AS returns,
      (SELECT count(*) FROM "ShiftSnapshot") AS snapshots,
      (SELECT count(*) FROM "Shift") AS shifts,
      (SELECT count(*) FROM "Cart") AS carts,
      (SELECT count(*) FROM "Review") AS reviews,
      (SELECT count(*) FROM "Session") AS sessions,
      (SELECT count(*) FROM "Account") AS accounts,
      (SELECT count(*) FROM "VerificationToken") AS verification_tokens,
      (SELECT count(*) FROM "StockAdjustment") AS stock_adjustments,
      (SELECT max("orderNumber") FROM "Order") AS max_order_no,
      (SELECT count(*) FROM "Menu") AS menus,
      (SELECT count(*) FROM "StockSupply") AS supplies,
      (SELECT count(*) FROM "Customer") AS customers,
      (SELECT count(*) FROM "User") AS users
  `);
  console.log("Pre-wipe counts:", JSON.stringify(pre.rows[0], null, 1));

  const force = process.argv.includes("--yes") || process.env.WIPE_CONFIRM === "1";
  let confirmed = force;
  if (!confirmed && process.stdin.isTTY) {
    const answer = await prompt(`Type RESET to wipe "${dbName}" now:`);
    confirmed = answer === "RESET";
  }
  if (!confirmed) {
    console.log("Aborted.");
    process.exit(0);
  }

  console.log("\nWiping transactional data (atomic transaction)...");
  await prisma.$transaction(async (tx) => {
    const steps: [string, Promise<{ count: number }>][] = [
      ["OrderItemAllocation", tx.orderItemAllocation.deleteMany()],
      ["ShiftSnapshot", tx.shiftSnapshot.deleteMany()],
      ["OrderItem", tx.orderItem.deleteMany()],
      ["Order", tx.order.deleteMany()],
      ["Shift", tx.shift.deleteMany()],
      ["Cart", tx.cart.deleteMany()],
      ["StockFulfillmentItem", tx.stockFulfillmentItem.deleteMany()],
      ["StockFulfillment", tx.stockFulfillment.deleteMany()],
      ["StockReturn", tx.stockReturn.deleteMany()],
      ["StockRequestItem", tx.stockRequestItem.deleteMany()],
      ["StockRequest", tx.stockRequest.deleteMany()],
      ["CookingRecordMenu", tx.cookingRecordMenu.deleteMany()],
      ["CookingRecord", tx.cookingRecord.deleteMany()],
      ["Review", tx.review.deleteMany()],
      ["Session", tx.session.deleteMany()],
      ["Account", tx.account.deleteMany()],
      ["VerificationToken", tx.verificationToken.deleteMany()],
    ];

    for (const [name, query] of steps) {
      const result = await query;
      if (result.count > 0) console.log(`  Deleted ${result.count} ${name}`);
    }

    // Heal the Menu.stock mirror for cooked dishes: shared/allocated batch feeds
    // are gone so the derived pool is 0; dishes fed by KEYED supplies keep their
    // keyed credit (same class as direct-sale stock). Direct-sale menus
    // (requiresCooking=false) and isAvailable are left as-is.
    const cookedMenus = await tx.menu.findMany({
      where: { requiresCooking: true },
      select: { id: true },
    });
    for (const menu of cookedMenus) {
      await recomputeMenuStock(tx, menu.id);
    }

    // Review counters stay consistent now that reviews are gone
    await tx.menu.updateMany({ data: { numReviews: 0 } });
  });

  // Restart order-number sequence so the first order of the new shift is #1
  const seqRows = await pool.query<{ seq: string }>("SELECT pg_get_serial_sequence('\"Order\"', 'orderNumber') AS seq");
  const seqName = String(seqRows.rows[0]?.seq ?? "");
  if (seqName) {
    await pool.query(`ALTER SEQUENCE ${seqName} RESTART WITH 1`);
    console.log(`Order sequence ${seqName} restarted at 1`);
  } else {
    console.warn("Could not resolve order-number sequence; order numbers will continue.");
  }

  const post = await pool.query<{
    orders: string;
    shifts: string;
    cooking_records: string;
    stock_requests: string;
    menus: string;
    supplies: string;
    customers: string;
    users: string;
  }>(`
    SELECT
      (SELECT count(*) FROM "Order") AS orders,
      (SELECT count(*) FROM "Shift") AS shifts,
      (SELECT count(*) FROM "CookingRecord") AS cooking_records,
      (SELECT count(*) FROM "StockRequest") AS stock_requests,
      (SELECT count(*) FROM "Menu") AS menus,
      (SELECT count(*) FROM "StockSupply") AS supplies,
      (SELECT count(*) FROM "Customer") AS customers,
      (SELECT count(*) FROM "User") AS users
  `);
  console.log("Post-wipe counts:", JSON.stringify(post.rows[0], null, 1));

  console.log("\nDone. Transactional data wiped; StockSupply, Menu catalog, Customers, Users preserved.");

  await pool.end();
  rl.close();
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => {
    void pool.end();
    void rl.close();
  });
