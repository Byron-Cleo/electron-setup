import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";
import { categorySeedData } from "./categories-from-db.js";

// Re-seeds the Category table from categories-from-db.ts.
// Run AFTER seed-extracted to realign Category rows with Menu categories.

async function main() {
  const connectionString = `${process.env.DATABASE_URL}`;
  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  await prisma.category.deleteMany();
  await prisma.category.createMany({ data: categorySeedData });
  console.log(`Seeded ${categorySeedData.length} categories`);

  await pool.end();
}

main();