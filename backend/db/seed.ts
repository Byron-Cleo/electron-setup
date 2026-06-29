import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";
import sampleData from "./sample-data";

async function main() {
  const connectionString = `${process.env.DATABASE_URL}`;
  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  // ── Wipe in reverse-FK order so constraints are never violated ────────────
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.review.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.menuServiceTimeType.deleteMany();
  await prisma.menu.deleteMany();
  await prisma.menuAccompaniment.deleteMany();
  await prisma.menuServiceTime.deleteMany();
  await prisma.account.deleteMany();
  await prisma.session.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.user.deleteMany();

  // ── Insert in FK-safe order ───────────────────────────────────────────────
  // 1. Accompaniments first — Menu.starchId/vegetableId point here.
  await prisma.menuAccompaniment.createMany({
    data: sampleData.accompaniments,
  });
  console.log("Seeded accompaniments");

  // 2. MenuServiceTime rows — MenuServiceTimeType.mealTypeId points here.
  await prisma.menuServiceTime.createMany({ data: sampleData.mealTypes });
  console.log("Seeded meal types");

  // 3. Menus — references starchId/vegetableId (already in DB above).
  await prisma.menu.createMany({ data: sampleData.menus });
  console.log("Seeded menus");

  // 4. Join table last — both menuId and mealTypeId must already exist.
  await prisma.menuServiceTimeType.createMany({
    data: sampleData.menuMealTypes,
  });
  console.log("Seeded menu meal types");

  // 5. Users — omitted for now (will be handled separately).
  console.log("Database seeded successfully");

  await pool.end();
}

main();
