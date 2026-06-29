import "dotenv/config";
import { hash } from "bcrypt-ts-edge";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.ts";

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const staff = [
    { name: "Admin User", email: "admin@eraeva.com", role: "admin", pin: "1234" },
    { name: "Waiter Jane", email: "waiter@eraeva.com", role: "waiter", pin: "1111" },
    { name: "Store Keeper", email: "store@eraeva.com", role: "store", pin: "2222" },
    { name: "Chef Bob", email: "kitchen@eraeva.com", role: "kitchen", pin: "3333" },
  ];

  for (const s of staff) {
    const hashedPin = await hash(s.pin, 12);
    await prisma.user.upsert({
      where: { email: s.email },
      update: { pin: hashedPin, role: s.role, isActive: true },
      create: {
        name: s.name,
        email: s.email,
        pin: hashedPin,
        role: s.role,
        isActive: true,
        updatedAt: new Date(),
      },
    });
    console.log(`Created: ${s.name} (${s.role}) - PIN: ${s.pin}`);
  }

  await pool.end();
}

main();
