import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.ts";

// One-off migration: menu images moved from the frontend public folder
// (public/images/sample-meals) to the backend uploads folder
// (backend/uploads/menu-items). Rewrites stored image paths so nothing breaks.

function migratePath(value: string): string {
  const clean = value.trim().replace(/^\/+/, "");
  if (clean.includes("images/sample-meals/")) {
    const filename = clean.split("/").pop();
    return `/uploads/menu-items/${filename}`;
  }
  return value;
}

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const menus = await prisma.menu.findMany({ select: { id: true, name: true, images: true } });
  let menuRows = 0;
  for (const menu of menus) {
    const images = (menu.images as string[]).map(migratePath);
    const changed = images.some((img, i) => img !== (menu.images as string[])[i]);
    if (changed) {
      await prisma.menu.update({ where: { id: menu.id }, data: { images } });
      menuRows += 1;
    }
  }

  const accompaniments = await prisma.menuAccompaniment.findMany({ select: { id: true, name: true, image: true } });
  let accompanimentRows = 0;
  for (const acc of accompaniments) {
    const image = migratePath(acc.image);
    if (image !== acc.image) {
      await prisma.menuAccompaniment.update({ where: { id: acc.id }, data: { image } });
      accompanimentRows += 1;
    }
  }

  console.log(`Migrated ${menuRows} menus and ${accompanimentRows} accompaniments.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
