import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.ts";

// One-off fix: rewrites stored menu image paths to /uploads/menu-items/<file>
// and remaps any basename that has no matching file in the uploads folder
// (backend/uploads/menu-items) to a real existing image.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, "../uploads/menu-items");

function exists(filename: string): boolean {
  return fs.existsSync(path.join(uploadsDir, filename));
}

const FALLBACKS: Record<string, string> = {
  "beef-stew-rice.png": "beef-fry-rice.png",
  "beef-stew-ugali.png": "beef-fry-ugali.png",
  "chicken-stew-rice.png": "chicken-fry-rice.png",
  "chicken-stew-chapati.png": "chicken-fry-chapati.png",
  "chicken-ticker-rice.png": "chicken-fry-rice.png",
  "chicken-ticker-chapati.png": "chicken-fry-chapati.png",
  "full-fish-special.png": "full-fish-fry-2.png",
  "half-fish-fry.png": "full-fish-fry.png",
};

function fixPath(value: string): { path: string; changed: boolean } {
  if (!value) return { path: value, changed: false };
  const clean = value.trim().replace(/^\/+/, "");
  const filename = clean.includes("images/sample-meals/")
    ? (clean.split("/").pop() ?? "")
    : path.basename(clean);
  const target = FALLBACKS[filename] ?? filename;
  const rewritten = `/uploads/menu-items/${target}`;
  return { path: rewritten, changed: rewritten !== value };
}

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const menus = await prisma.menu.findMany({ select: { id: true, name: true, images: true } });
  let menuRows = 0;
  let remapped = 0;
  for (const menu of menus) {
    const images = (menu.images as string[]).map((img) => fixPath(img).path);
    const changed = images.some((img, i) => img !== (menu.images as string[])[i]);
    if (changed) {
      await prisma.menu.update({ where: { id: menu.id }, data: { images } });
      menuRows += 1;
      const bad = (menu.images as string[]).filter((img) => FALLBACKS[path.basename(img)]);
      if (bad.length > 0) remapped += 1;
      console.log(`  ${menu.name}: ${JSON.stringify(menu.images)} -> ${JSON.stringify(images)}`);
    }
  }

  const accompaniments = await prisma.menuAccompaniment.findMany({
    select: { id: true, name: true, image: true },
  });
  let accompanimentRows = 0;
  for (const acc of accompaniments) {
    const image = fixPath(acc.image).path;
    if (image !== acc.image) {
      await prisma.menuAccompaniment.update({ where: { id: acc.id }, data: { image } });
      accompanimentRows += 1;
    }
  }

  console.log(`Migrated ${menuRows} menus (${remapped} with remapped images) and ${accompanimentRows} accompaniments.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
