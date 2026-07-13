import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, AccompanimentType, ItemUnit } from "./generated/prisma/client";
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
  await prisma.menuMealType.deleteMany();
  await prisma.menu.deleteMany();
  await prisma.menuAccompaniment.deleteMany();
  await prisma.item.deleteMany();
  await prisma.itemCategory.deleteMany();
  await prisma.account.deleteMany();
  await prisma.session.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.user.deleteMany();

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
  await prisma.menu.createMany({ data: sampleData.menus });
  console.log("Seeded menus");

  // 3. MenuMealType last — menuId must already exist.
  await prisma.menuMealType.createMany({ data: sampleData.menuMealTypes });
  console.log("Seeded menu meal type assignments");

  // 4. Users — PIN-based staff for login testing.
  await prisma.user.createMany({ data: sampleData.users });
  console.log("Seeded users");

  // 5. Item Categories — must exist before items.
  await prisma.itemCategory.createMany({ data: sampleData.itemCategories });
  console.log("Seeded item categories");

  // 6. Items — references categoryId (looked up by category name).
  const categories = await prisma.itemCategory.findMany();
  const categoryMap = new Map(categories.map((c) => [c.name, c.id]));

  const itemsWithIds = sampleData.items.map((item) => {
    const { categoryName, ...rest } = item;
    return {
      ...rest,
      slug: item.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
      categoryId: categoryMap.get(categoryName)!,
      unit: rest.unit as ItemUnit,
    };
  });

  await prisma.item.createMany({ data: itemsWithIds });
  console.log("Seeded items");

  console.log("Database seeded successfully");

  await pool.end();
}

main();
