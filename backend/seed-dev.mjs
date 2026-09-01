import { PrismaClient } from "../db/generated/prisma/client.js";
const prisma = new PrismaClient({ adapter: new (await import("@prisma/adapter-pg")).PrismaPg(new (await import("pg")).default({ connectionString: process.env.DATABASE_URL })) });

async function run() {
  const user = await prisma.user.create({
    data: { name: "dev-user", email: "dev@example.com", role: "staff", isActive: true, updatedAt: new Date() },
  });
  console.log("Created user:", user.id);

  const shift = await prisma.shift.create({
    data: { type: "LUNCH", date: new Date(), autoOpenTime: new Date(), autoCloseTime: new Date(), isOpen: true, openedById: user.id },
  });
  console.log("Created shift:", shift.id);

  const menu = await prisma.menu.create({
    data: { name: "Fish Fry", slug: "fish-fry-dev", category: "main", price: 10, stock: 20, hasStarch: false, hasVegetable: false },
  });
  console.log("Created menu:", menu.id);

  await prisma.$disconnect();
}
run();
