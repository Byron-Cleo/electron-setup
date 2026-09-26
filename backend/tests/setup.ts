import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../db/generated/prisma/client.js";
import { beforeEach, afterAll } from "vitest";

const connectionString = process.env.DATABASE_URL!;
const pool = new pg.Pool({ connectionString, options: "-c TimeZone=UTC" });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

beforeEach(async () => {
  // Delete in reverse dependency order (children first, parents last)
  await prisma.cookingRecordMenu.deleteMany({}).catch(() => {});
  await prisma.cookingRecord.deleteMany({}).catch(() => {});
  await prisma.shiftSnapshot.deleteMany({}).catch(() => {});
  await prisma.orderItem.deleteMany({}).catch(() => {});
  await prisma.order.deleteMany({}).catch(() => {});
  // Customers must go after orders: Order.customerId references them.
  // Without this the fixed test phone numbers collide on the second run.
  await prisma.customer.deleteMany({}).catch(() => {});
  await prisma.shift.deleteMany({}).catch(() => {});
  await prisma.shiftConfig.deleteMany({}).catch(() => {});
  await prisma.menu.deleteMany({}).catch(() => {});
  await prisma.menuAccompaniment.deleteMany({}).catch(() => {});
  await prisma.stockSupply.deleteMany({}).catch(() => {});
  await prisma.cart.deleteMany({}).catch(() => {});
  await prisma.account.deleteMany({}).catch(() => {});
  await prisma.review.deleteMany({}).catch(() => {});
  await prisma.session.deleteMany({}).catch(() => {});
  await prisma.verificationToken.deleteMany({}).catch(() => {});
  // Note: Users are kept to avoid unique email conflicts; createTestUser uses random emails
});

afterAll(async () => {
  await prisma.$disconnect();
});

export { prisma };
