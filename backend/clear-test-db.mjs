import { PrismaClient } from "../db/generated/prisma/client.js";
const adapter = new (await import("@prisma/adapter-pg")).PrismaPg(new (await import("pg")).default({ connectionString: process.env.DATABASE_URL || "postgresql://mac@localhost:5432/eraevadb_test" }));
const prisma = new PrismaClient({ adapter });
await prisma.shiftSnapshot.deleteMany({});
await prisma.orderItem.deleteMany({});
await prisma.order.deleteMany({});
await prisma.shift.deleteMany({});
console.log("DB cleared: ShiftSnapshot, OrderItem, Order, Shift only. Menu/CookingRecord preserved.");
await prisma.$disconnect();
