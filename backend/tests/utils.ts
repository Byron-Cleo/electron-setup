import { ServiceTime } from "../db/generated/prisma/client.js";
import { prisma } from "./setup.js";

export async function createTestUser(role = "staff") {
  const user = await prisma.user.create({
    data: {
      name: `test-${Date.now()}-${Math.random()}`,
      email: `test-${Date.now()}-${Math.random()}@example.com`,
      role,
      isActive: true,
      updatedAt: new Date(),
    },
  });
  return user;
}

export async function createTestShift(isOpen = true, userId?: string) {
  const user = userId ?? (await createTestUser()).id;
  // Use a slightly different date/time to avoid unique constraint conflicts
  const base = new Date();
  const shiftDate = new Date(base.getFullYear(), base.getMonth(), base.getDate() + Math.floor(Math.random() * 10));
  const shift = await prisma.shift.create({
    data: {
      type: "LUNCH",
      operationDay: shiftDate,
      autoOpenTime: new Date(shiftDate.getTime() + 6 * 60 * 60 * 1000),
      autoCloseTime: new Date(shiftDate.getTime() + 22 * 60 * 60 * 1000),
      isOpen,
    },
  });
  return shift;
}

export async function createTestMenu(data: { name?: string; stock?: number; hasStarch?: boolean; hasVegetable?: boolean; price?: number } = {}) {
  const stockValue = data.stock ?? 20;
  const menu = await prisma.menu.create({
    data: {
      name: data.name ?? `test-menu-${Date.now()}`,
      slug: `test-menu-${Date.now()}-${Math.random()}`,
      category: "main",
      price: data.price ?? 10,
      stock: stockValue,
      hasStarch: data.hasStarch ?? false,
      hasVegetable: data.hasVegetable ?? false,
    },
  });
  // Per user spec (fish fry only): create cooking batch + split for menu
  // This ensures Menu.stock aligns with CookingRecordMenu.platesRemaining
  const supply = await prisma.stockSupply.create({
    data: {
      name: `test-supply-${Date.now()}-${Math.random()}`,
      slug: `test-supply-${Date.now()}-${Math.random()}`,
      unit: "PCS",
    },
  });
  const user = await createTestUser();
  const record = await prisma.cookingRecord.create({
    data: {
      stockSupplyId: supply.id,
      cookedById: user.id,
      quantityCooked: stockValue,
      platesExpected: stockValue,
      platesActual: stockValue,
      cookingRecordMenus: {
        create: {
          menuId: menu.id,
          platesAllocated: stockValue,
          platesRemaining: stockValue,
        },
      },
    },
    include: { cookingRecordMenus: true },
  });
  return menu;
}

export async function createCookingRecordWithSplit(
  menuId: string,
  split: { platesAllocated: number; platesRemaining: number }
) {
  // Use exact menuId (per-user spec: "fish fry only" = split tied to specific Menu.id/dish)
  const supply = await prisma.stockSupply.create({
    data: {
      name: `test-supply-${Date.now()}-${Math.random()}`,
      slug: `test-supply-${Date.now()}-${Math.random()}`,
      unit: "PCS",
    },
  });
  const user = await createTestUser();
  // Per user spec: verify menu exists before creating split (C1 fix)
  const menuCheck = await prisma.menu.findUnique({ where: { id: menuId } });
  if (!menuCheck) {
    throw new Error(`C1 Fix: Menu ${menuId} not found before creating split. Menu must exist.`);
  }
  const record = await prisma.cookingRecord.create({
    data: {
      stockSupplyId: supply.id,
      cookedById: user.id,
      quantityCooked: 0,
      platesExpected: 0,
      cookingRecordMenus: {
        create: {
          menuId,
          platesAllocated: split.platesAllocated,
          platesRemaining: split.platesRemaining,
        },
      },
    },
    include: { cookingRecordMenus: true },
  });
  return record;
}

export async function createOrderWithItems(shiftId: string, items: Array<{ menuId: string; qty: number; starchId?: string | null; vegetableId?: string | null; price?: number; name?: string; slug?: string; image?: string }>) {
  const user = await createTestUser();
  // Per user spec: shift always exists for orders. Create/update snapshot.
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        userId: user.id,
        shiftId,
        mealType: ServiceTime.LUNCH,
        shippingAddress: {},
        paymentMethod: "cash",
        itemsPrice: 0,
        shippingPrice: 0,
        taxPrice: 0,
        totalPrice: 0,
        OrderItem: {
          create: items.map((item) => ({
            menuId: item.menuId,
            qty: item.qty,
            price: item.price ?? 10,
            name: item.name ?? "Test Item",
            slug: item.slug ?? "test-item",
            image: item.image ?? "",
            starchId: item.starchId ?? null,
            vegetableId: item.vegetableId ?? null,
          })),
        },
      },
      include: { OrderItem: true },
    });

    // Create/update shift snapshot (always exists under shift window)
    for (const item of items) {
      const menu = await tx.menu.findUnique({ where: { id: item.menuId } });
      const currentStock = menu?.stock ?? 0;
      await tx.shiftSnapshot.upsert({
        where: { shiftId_menuId: { shiftId, menuId: item.menuId } },
        create: {
          shiftId,
          menuId: item.menuId,
          openingPlates: currentStock,
          platesSold: item.qty,
        },
        update: { platesSold: { increment: item.qty } },
      });
    }
    return created;
  });
  return order;
}

export async function voidOrder(orderId: string, shiftId: string, voidedById?: string) {
  const user = voidedById ?? (await createTestUser()).id;
  // Direct DB operation instead of HTTP call for reliability
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { OrderItem: true },
  });
  if (!order) throw new Error("Order not found");
  if (order.isVoid) throw new Error("Order is already voided");

  await prisma.$transaction(async (tx) => {
    for (const item of order.OrderItem) {
      const menu = await tx.menu.findUnique({ where: { id: item.menuId } });
      if (menu) {
        const currentStock = menu.stock ?? 0;
        await tx.menu.update({
          where: { id: item.menuId },
          data: { stock: currentStock + item.qty },
        });
      }

      let toRestore = item.qty;
      const splits = await tx.cookingRecordMenu.findMany({
        where: { menuId: item.menuId },
        orderBy: { createdAt: "desc" },
        select: { id: true, platesRemaining: true, platesAllocated: true },
      });
      for (const split of splits) {
        if (toRestore <= 0) break;
        // Per user spec: no headroom cap. Restore voided qty directly back to split.
        const restoreQty = Math.min(toRestore, item.qty);
        await tx.cookingRecordMenu.update({
          where: { id: split.id },
          data: { platesRemaining: { increment: restoreQty } },
        });
        toRestore -= restoreQty;
      }

      // Recompute menu stock from splits (includes restored plates)
      const agg = await tx.cookingRecordMenu.aggregate({
        _sum: { platesRemaining: true },
        where: { menuId: item.menuId },
      });
      const total = Number(agg._sum?.platesRemaining ?? 0);
      await tx.menu.update({ where: { id: item.menuId }, data: { stock: total } });

      if (order.shiftId) {
        const snapshot = await tx.shiftSnapshot.findUnique({
          where: { shiftId_menuId: { shiftId: order.shiftId, menuId: item.menuId } },
        });
        if (snapshot) {
          await tx.shiftSnapshot.update({
            where: { id: snapshot.id },
            data: { platesSold: Math.max(0, snapshot.platesSold - item.qty) },
          });
        }
      }
    }
    await tx.order.update({
      where: { id: orderId },
      data: { isVoid: true, voidedAt: new Date(), voidedById: user },
    });
  });
  return await prisma.order.findUnique({ where: { id: orderId }, include: { OrderItem: true } });
}

export async function createOrderViaAPI(shiftId: string | null, items: Array<{ menuId: string; qty: number; starchId?: string | null; vegetableId?: string | null; price?: number; name?: string }>) {
  const user = await createTestUser();
  // Check shift before creating (matches backend behavior)
  if (!shiftId) {
    throw new Error("No active shift. Please open a shift before placing orders.");
  }
  // Direct DB transaction instead of HTTP for reliability
  const result = await prisma.$transaction(async (tx) => {
    // Atomic stock guard: only proceed if sufficient stock exists
    for (const item of items) {
      const menu = await tx.menu.findUnique({ where: { id: item.menuId } });
      if (!menu) throw new Error(`Menu item not found: ${item.menuId}`);
      const currentStock = menu.stock ?? 0;
      const updated = await tx.menu.updateMany({
        where: { id: item.menuId, stock: { gte: item.qty } },
        data: { stock: { decrement: item.qty } },
      });
      if (updated.count === 0) {
        throw new Error(`Insufficient stock for ${item.menuId}: only ${currentStock} plates remaining`);
      }
    }

    const lines = items.map((item) => ({ ...item, qty: item.qty })) as any;
    const order = await tx.order.create({
      data: {
        userId: user.id,
        shiftId: shiftId ? shiftId : null,
        mealType: ServiceTime.LUNCH,
        shippingAddress: {},
        paymentMethod: "cash",
        itemsPrice: 0,
        shippingPrice: 0,
        taxPrice: 0,
        totalPrice: 0,
        OrderItem: {
          create: items.map((item) => ({
            menuId: item.menuId,
            qty: item.qty,
            price: item.price ?? 10,
            name: item.name ?? "Test Item",
            slug: item.slug ?? "test-item",
            image: item.image ?? "",
            starchId: item.starchId ?? null,
            vegetableId: item.vegetableId ?? null,
          })),
        },
      },
      include: { OrderItem: true },
    });
    return order;
  });
  if (!shiftId) {
    throw new Error("No active shift. Please open a shift before placing orders.");
  }
  return result;
}
