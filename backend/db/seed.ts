import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, AccompanimentType, ItemUnit } from "./generated/prisma/client.js";
import sampleData from "./sample-data.js";

async function main() {
  const connectionString = `${process.env.DATABASE_URL}`;
  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  // ── Wipe in reverse-FK order so constraints are never violated ────────────
  await prisma.shiftSnapshot.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.stockFulfillmentItem.deleteMany();
  await prisma.stockFulfillment.deleteMany();
  await prisma.stockRequestItem.deleteMany();
  await prisma.stockRequest.deleteMany();
  await prisma.cookingRecord.deleteMany();
  await prisma.departmentStockSupply.deleteMany();
  await prisma.stockSupplyMenu.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.review.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.menuMealType.deleteMany();
  await prisma.menu.deleteMany();
  await prisma.menuAccompaniment.deleteMany();
  await prisma.stockSupply.deleteMany();
  await prisma.account.deleteMany();
  await prisma.session.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.category.deleteMany();

  // ── Insert in FK-safe order ───────────────────────────────────────────────
  // 1. Accompaniments first — Menu.starchId/vegetableId point here.
  await prisma.menuAccompaniment.createMany({
    data: sampleData.accompaniments.map((a) => ({
      ...a,
      category: a.category as AccompanimentType,
    })),
  });
  console.log("Seeded accompaniments");

  // 2. Menus — references starchId/vegetableId (already in DB above).
  await prisma.menu.createMany({
    data: sampleData.menus.map((m) => ({ ...m, stock: 0 })),
  });
  console.log("Seeded menus");

  // 3. MenuMealType last — menuId must already exist.
  await prisma.menuMealType.createMany({ data: sampleData.menuMealTypes });
  console.log("Seeded menu meal type assignments");

  // 4. Users — PIN-based staff for login testing.
  await prisma.user.createMany({ data: sampleData.users });
  console.log("Seeded users");

  // 5. Stock Supplies
  const suppliesWithIds = sampleData.stockSupplies.map((item) => ({
    ...item,
    slug: item.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
    unit: item.unit as ItemUnit,
  }));

  await prisma.stockSupply.createMany({ data: suppliesWithIds });
  console.log("Seeded stock supplies");

  // 6. Departments
  await prisma.department.createMany({ data: sampleData.departments });
  console.log("Seeded departments");

  // 7. Categories
  const categories = [
    "Beef", "Chicken", "Vegetable", "Drinks", "Beverages",
    "Starch", "Fish", "1/2 Fish", "Liver", "Matumbo", "Snacks", "Staff",
  ];
  await prisma.category.createMany({
    data: categories.map((name) => ({ name })),
  });
  console.log("Seeded categories");

  console.log("Database seeded successfully");

  await pool.end();
}

main();
