import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./db/generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL!;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const cashiers = await prisma.user.findMany({ where: { role: "cashier" } });
  console.log("Cashier users:", JSON.stringify(cashiers, null, 2));
  const allUsers = await prisma.user.findMany({ select: { name: true, role: true, isActive: true, hasPin: true } });
  console.log("All users:", JSON.stringify(allUsers, null, 2));
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());