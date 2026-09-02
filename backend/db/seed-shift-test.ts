import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, ServiceTime } from "./generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL!;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Helpers ---------------------------------------------------------------

// Calendar date → UTC midnight Date (matches scheduler dateOnly(/ @db.Date) convention).
function dateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// "YYYY-MM-DDTHH:MM" in Africa/Nairobi (UTC+3) → Date.
// Returns a UTC Date whose instant corresponds to the EAT wall clock.
function eat(dateStr: string, time: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  // EAT = UTC+3
  return new Date(Date.UTC(y, m - 1, d, hh - 3, mm, 0));
}

async function main() {
  console.log("\n[seed-shift-test] Resetting transactional data (menus/users preserved)...\n");

  // Preserve Users, Departments, StockSupply, and menu catalog.
  const steps: Promise<unknown>[] = [
    prisma.shiftSnapshot.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.shift.deleteMany(),
    prisma.shiftConfig.deleteMany(),
    prisma.cart.deleteMany(),
    prisma.cookingRecordMenu.deleteMany(),
    prisma.cookingRecord.deleteMany(),
    prisma.review.deleteMany(),
    prisma.account.deleteMany(),
    prisma.session.deleteMany(),
    prisma.verificationToken.deleteMany(),
  ];
  await Promise.all(steps);
  console.log("  Cleared orders, shifts, shift-configs, carts, cooking records\n");

  // Resolve valid user + menu references from the (preserved) DB.
  const waiter = await prisma.user.findFirstOrThrow({
    where: { email: "waiter@example.com" },
  });
  const beefFry = await prisma.menu.findFirstOrThrow({ where: { slug: "beef-fry" } });
  const chickenFry = await prisma.menu.findFirstOrThrow({ where: { slug: "chicken-fry" } });
  const chips = await prisma.menu.findFirstOrThrow({ where: { slug: "chips" } });
  const beefStew = await prisma.menu.findFirstOrThrow({ where: { slug: "beef-stew" } });

  const menuMap = { beefFry, chickenFry, chips, beefStew };
  const menuNames: Record<string, string> = Object.fromEntries(
    Object.entries(menuMap).map(([k, m]) => [k, m.name]),
  );

  // Shift configs (inactive so the scheduler never touches them).
  const eveningConfig = await prisma.shiftConfig.create({
    data: {
      type: "Evening Shift",
      autoOpenTime: "17:30",
      autoCloseTime: "05:30",
      isActive: false,
      manual: false,
      anchorIntervalMinutes: 1440,
    },
  });
  const dayConfig = await prisma.shiftConfig.create({
    data: {
      type: "Day Shift",
      autoOpenTime: "10:00",
      autoCloseTime: "14:00",
      isActive: false,
      manual: false,
      anchorIntervalMinutes: 1440,
    },
  });
  console.log(`  Created configs: ${eveningConfig.type}, ${dayConfig.type}\n`);

  // Shift instances: Evening + Day for Sep 02, 03, 04.
  // operationDay = the day the shift OPENS.
  const DAYS = ["2026-09-02", "2026-09-03", "2026-09-04"];

  const eveningShifts = new Map<string, { id: string }>();
  const dayShifts = new Map<string, { id: string }>();

  for (const d of DAYS) {
    const eOpen = eat(d, "17:30");
    const eClose = eat(d, "05:30");
    eClose.setDate(eClose.getDate() + 1);
    const eshift = await prisma.shift.create({
      data: {
        type: eveningConfig.type,
        operationDay: dateOnly(d),
        autoOpenTime: eOpen,
        autoCloseTime: eClose,
        isOpen: false,
        createdAt: eOpen,
      },
    });
    eveningShifts.set(d, { id: eshift.id });

    const dOpen = eat(d, "10:00");
    const dClose = eat(d, "14:00");
    const dshift = await prisma.shift.create({
      data: {
        type: dayConfig.type,
        operationDay: dateOnly(d),
        autoOpenTime: dOpen,
        autoCloseTime: dClose,
        isOpen: false,
        createdAt: dOpen,
      },
    });
    dayShifts.set(d, { id: dshift.id });
  }
  console.log("  Created 6 shift instances (Evening & Day × Sep 02/03/04)\n");

  // Orders -----------------------------------------------------------------
  // Each order: explicit createdAt (EAT) + explicit shiftId so we fully control
  // where it lands. item = which preset menu card to use.
  type SeedOrder = {
    label: string;
    shift: { id: string };
    date: string; // EAT date
    time: string; // EAT time "HH:MM"
    mealType: ServiceTime;
    item: keyof typeof menuMap;
    paid: boolean;
    method?: "cash" | "mpesa";
    batch?: boolean;
  };

  const orders: SeedOrder[] = [
    // Evening Sep 02
    { label: "A", shift: eveningShifts.get("2026-09-02")!, date: "2026-09-02", time: "18:00", mealType: "DINNER", item: "beefFry", paid: true, method: "cash" },
    { label: "B", shift: eveningShifts.get("2026-09-02")!, date: "2026-09-02", time: "23:30", mealType: "DINNER", item: "chickenFry", paid: true, method: "mpesa" },
    { label: "C", shift: eveningShifts.get("2026-09-02")!, date: "2026-09-03", time: "00:30", mealType: "DINNER", item: "chips", paid: false },
    { label: "D", shift: eveningShifts.get("2026-09-02")!, date: "2026-09-03", time: "04:00", mealType: "DINNER", item: "beefFry", paid: true, method: "mpesa" },
    // Evening Sep 04 (latest day → default view has data)
    { label: "E2", shift: eveningShifts.get("2026-09-04")!, date: "2026-09-04", time: "18:00", mealType: "DINNER", item: "chickenFry", paid: true, method: "cash" },
    // Day Sep 02
    { label: "F", shift: dayShifts.get("2026-09-02")!, date: "2026-09-02", time: "11:00", mealType: "LUNCH", item: "beefStew", paid: true, method: "cash" },
    { label: "G", shift: dayShifts.get("2026-09-02")!, date: "2026-09-02", time: "13:30", mealType: "LUNCH", item: "beefFry", paid: false },
    // Day Sep 03
    { label: "H", shift: dayShifts.get("2026-09-03")!, date: "2026-09-03", time: "10:30", mealType: "LUNCH", item: "chips", paid: true, method: "mpesa" },
    // Day Sep 04 (latest day → default view has data)
    { label: "I", shift: dayShifts.get("2026-09-04")!, date: "2026-09-04", time: "11:30", mealType: "LUNCH", item: "chickenFry", paid: true, method: "cash" },
  ];

  for (const o of orders) {
    const menu = menuMap[o.item];
    const price = Number(menu.price);
    const createdAt = eat(o.date, o.time);
    const batchId = o.batch ? `batch-${o.date}-${o.label}` : null;

    const order = await prisma.order.create({
      data: {
        userId: waiter.id,
        shiftId: o.shift.id,
        createdAt,
        mealType: o.mealType,
        shippingAddress: {},
        paymentMethod: o.paid ? o.method! : "unpaid",
        paymentResult: o.paid
          ? { id: `seed-${o.label}`, status: "ok", update_time: createdAt.toISOString() }
          : undefined,
        isPaid: o.paid,
        paidAt: o.paid ? createdAt : null,
        isDelivered: false,
        itemsPrice: price,
        shippingPrice: 0,
        taxPrice: 0,
        totalPrice: price,
        paymentType: o.paid ? (o.batch ? "BATCH" : "SINGLE") : null,
        batchId,
      },
    });

    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        menuId: menu.id,
        qty: 1,
        price,
        name: menu.name,
        slug: menu.slug,
        image: (menu.images && menu.images[0]) || "",
      },
    });

    // Shift snapshot for the sold menu so reports don't break.
    const snap = await prisma.shiftSnapshot.findFirst({
      where: { shiftId: o.shift.id, menuId: menu.id },
    });
    if (snap) {
      await prisma.shiftSnapshot.update({
        where: { id: snap.id },
        data: { platesSold: { increment: 1 } },
      });
    } else {
      await prisma.shiftSnapshot.create({
        data: {
          shiftId: o.shift.id,
          menuId: menu.id,
          openingPlates: 10,
          platesSold: 1,
        },
      });
    }

    console.log(
      `  Order ${o.label}: ${o.date} ${o.time} EAT → shift opDay ${o.shift.id.slice(0, 8)}... ` +
        `item=${menuNames[o.item]} ${o.paid ? `PAID(${o.method})` : "UNPAID"}`,
    );
  }

  console.log(`\n[seed-shift-test] Done. Seeded ${orders.length} orders.`);
  console.log(
    "  Expected grouping:\n" +
      "    Evening Sep 02 (opDay 2026-09-02): A, B, C, D  (C&D created Sep 03 → still grouped under Sep 02)\n" +
      "    Evening Sep 04 (opDay 2026-09-04): E2\n" +
      "    Day Sep 02 (opDay 2026-09-02): F, G\n" +
      "    Day Sep 03 (opDay 2026-09-03): H\n" +
      "    Day Sep 04 (opDay 2026-09-04): I\n",
  );

  await pool.end();
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
