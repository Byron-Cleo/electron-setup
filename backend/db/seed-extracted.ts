import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, AccompanimentType, ServiceTime } from "./generated/prisma/client.js";
import { extractedMenuItems } from "./extracted-menu-data.js";
import { extractedAccompaniments } from "./extracted-accompaniments.js";

// Category → meal period assignments for pre-assigned MenuMealType rows.
const mealTypesByCategory: Record<string, ServiceTime[]> = {
  "Hot Beverages": [ServiceTime.BREAKFAST],
  Snacks: [ServiceTime.BREAKFAST],
  Chicken: [ServiceTime.LUNCH, ServiceTime.DINNER],
  "Boiled Beef": [ServiceTime.LUNCH, ServiceTime.DINNER],
  Matumbo: [ServiceTime.LUNCH, ServiceTime.DINNER],
  "Mbuzi Fry": [ServiceTime.LUNCH, ServiceTime.DINNER],
  "Beef Fry": [ServiceTime.LUNCH, ServiceTime.DINNER],
  Fish: [ServiceTime.LUNCH, ServiceTime.DINNER],
  "Vegetable Plates": [ServiceTime.LUNCH, ServiceTime.DINNER],
  "Special Meals": [ServiceTime.LUNCH, ServiceTime.DINNER],
  Cereals: [ServiceTime.BREAKFAST, ServiceTime.LUNCH, ServiceTime.DINNER],
  "Bottled Drinks": [ServiceTime.BEVERAGE],
};

async function main() {
  const connectionString = `${process.env.DATABASE_URL}`;
  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  // ── Wipe Menu only — MenuMealType rows removed via CASCADE ───────────────
  // ShiftSnapshot has ON DELETE RESTRICT on Menu, so clear it first.
  // Snapshots are transient shift data and become stale once menus are replaced.
  await prisma.shiftSnapshot.deleteMany();
  await prisma.menu.deleteMany();
  console.log("Wiped ShiftSnapshot + Menu table");

  // ── Seed Menu from extracted-menu-data.ts ────────────────────────────────
  await prisma.menu.createMany({
    data: extractedMenuItems.map((m) => ({
      name: m.name,
      slug: m.slug,
      price: m.price ?? "0.00",
      category: m.category,
      images: [],
      stock: 0,
      numReviews: 0,
      banner: null,
      hasStarch: false,
      hasVegetable: false,
      starchId: null,
      vegetableId: null,
      isAvailable: true,
    })),
  });
  console.log(`Seeded ${extractedMenuItems.length} menus`);

  // ── Pre-assign MenuMealType (BREAKFAST/LUNCH/DINNER/BEVERAGE) by category ─
  const menus = await prisma.menu.findMany({ select: { id: true, slug: true, category: true } });
  const menuMealTypes = menus.flatMap((menu) =>
    (mealTypesByCategory[menu.category] ?? []).map((mealType) => ({
      menuId: menu.id,
      mealType,
    })),
  );
  if (menuMealTypes.length > 0) {
    await prisma.menuMealType.createMany({ data: menuMealTypes });
  }
  console.log(`Seeded ${menuMealTypes.length} menu meal type assignments`);

  // ── Seed Accompaniments — add on top, NO wipe ────────────────────────────
  // Note: MenuAccompaniment has no slug column, so it is not included.
  await prisma.menuAccompaniment.createMany({
    data: extractedAccompaniments.map((a) => ({
      name: a.name,
      description: a.description,
      price: a.price,
      image: a.image,
      isDefault: a.isDefault,
      category: a.category as AccompanimentType,
    })),
  });
  console.log(`Seeded ${extractedAccompaniments.length} accompaniments (added on top)`);

  console.log("Seed complete");
  await pool.end();
}

main();