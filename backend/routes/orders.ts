import { Router } from "express";
import prisma from "../db/db.js";
import { ServiceTime } from "../db/generated/prisma/client.js";

const router = Router();

router.get("/count", async (_req, res) => {
  try {
    const count = await prisma.order.count();
    res.json({ count });
  } catch (e) {
    console.error("Error counting orders:", e);
    res.status(500).json({ error: "Failed to count orders" });
  }
});

router.get("/", async (req, res) => {
  let where: { orderNumber?: number } = {};
  if (req.query.orderNumber !== undefined) {
    const n = Number(req.query.orderNumber);
    if (!Number.isInteger(n) || n < 1) {
      return res.status(400).json({ error: "orderNumber must be a positive integer" });
    }
    where = { orderNumber: n };
  }

  try {
    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        OrderItem: { include: { Starch: true, Vegetable: true } },
        User: { select: { name: true } },
      },
    });
    res.json(orders);
  } catch (e) {
    console.error("Error listing orders:", e);
    res.status(500).json({ error: "Failed to list orders" });
  }
});

router.post("/", async (req, res) => {
  const { userId, items, mealType, voidedOrderId } = req.body;

  if (!userId || !items?.length || !mealType) {
    return res.status(400).json({ error: "userId, items, and mealType are required" });
  }

  if (!Object.values(ServiceTime).includes(mealType)) {
    return res.status(400).json({ error: `Invalid mealType. Must be one of: ${Object.values(ServiceTime).join(", ")}` });
  }

  const lineKey = (item: { menuId: string; starchId?: string | null; vegetableId?: string | null }) =>
    `${item.menuId}|${item.starchId ?? ""}|${item.vegetableId ?? ""}`;
  const merged = new Map<string, (typeof items)[number]>();
  for (const item of items) {
    const key = lineKey(item);
    const existing = merged.get(key);
    if (existing) {
      existing.qty += item.qty;
    } else {
      merged.set(key, { ...item });
    }
  }
  const lines = [...merged.values()];

  const shippingPrice = 0;
  const taxPrice = 0;

  // Link the order to the currently open shift (if any) for plate tracking
  const currentShift = await prisma.shift.findFirst({
    where: { isOpen: true },
    select: { id: true },
  });

  try {
    // Optional replacement link: new order replaces an existing VOIDED order
    let replacementOf: { id: string } | null = null;
    if (voidedOrderId) {
      replacementOf = await prisma.order.findFirst({
        where: { id: voidedOrderId, isVoid: true },
        select: { id: true },
      });
      if (!replacementOf) {
        return res.status(400).json({ error: "voidedOrderId must reference an existing voided order" });
      }
    }

    const order = await prisma.$transaction(async (tx) => {
      let itemsPrice = 0;
      const resolvedAccompaniments: { starchId: string | null; vegetableId: string | null }[] = [];
      for (const item of lines) {
        const [starch, vegetable] = await Promise.all([
          item.starchId
            ? tx.menuAccompaniment.findUnique({ where: { id: item.starchId }, select: { price: true } })
            : Promise.resolve(null),
          item.vegetableId
            ? tx.menuAccompaniment.findUnique({ where: { id: item.vegetableId }, select: { price: true } })
            : Promise.resolve(null),
        ]);
        itemsPrice +=
          (Number(item.price) + Number(starch?.price ?? 0) + Number(vegetable?.price ?? 0)) * item.qty;
        resolvedAccompaniments.push({
          starchId: starch ? item.starchId ?? null : null,
          vegetableId: vegetable ? item.vegetableId ?? null : null,
        });
      }
      const totalPrice = itemsPrice + shippingPrice + taxPrice;

      const created = await tx.order.create({
        data: {
          userId,
          shippingAddress: {},
          paymentMethod: "unpaid",
          itemsPrice,
          shippingPrice,
          taxPrice,
          totalPrice,
          mealType,
          ...(replacementOf ? { voidedOrderId: replacementOf.id } : {}),
          ...(currentShift ? { shiftId: currentShift.id } : {}),
        },
      });

      for (let i = 0; i < lines.length; i++) {
        const item = lines[i];
        await tx.orderItem.create({
          data: {
            orderId: created.id,
            menuId: item.menuId,
            qty: item.qty,
            price: item.price,
            name: item.name,
            slug: item.slug,
            image: item.image,
            starchId: resolvedAccompaniments[i]?.starchId ?? null,
            vegetableId: resolvedAccompaniments[i]?.vegetableId ?? null,
          },
        });

        const menu = await tx.menu.findUniqueOrThrow({ where: { id: item.menuId } });
        const currentStock = menu.stock ?? 0;
        const remaining = Math.max(0, currentStock - item.qty);
        await tx.menu.update({
          where: { id: item.menuId },
          data: {
            stock: remaining,
            isAvailable: remaining > 0,
          },
        });

        // Track plates sold on the shift snapshot (openingPlates falls back to
        // pre-sale stock when the item has no snapshot — e.g. added mid-shift)
        if (currentShift) {
          await tx.shiftSnapshot.upsert({
            where: { shiftId_menuId: { shiftId: currentShift.id, menuId: item.menuId } },
            create: {
              shiftId: currentShift.id,
              menuId: item.menuId,
              openingPlates: currentStock,
              platesSold: item.qty,
            },
            update: { platesSold: { increment: item.qty } },
          });
        }
      }

      return tx.order.findUnique({
        where: { id: created.id },
        include: { OrderItem: true },
      });
    });

    res.status(201).json(order);
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2025") {
      return res.status(404).json({ error: "Menu item not found" });
    }
    console.error("Error creating order:", e);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// Update payment method and mark as paid
router.patch("/:id/payment", async (req, res) => {
  const { id } = req.params;
  const { paymentMethod, paymentType, batchId } = req.body;

  if (!paymentMethod || !["cash", "mpesa"].includes(paymentMethod)) {
    return res.status(400).json({ error: "paymentMethod must be 'cash' or 'mpesa'" });
  }

  if (paymentType && !["SINGLE", "BATCH"].includes(paymentType)) {
    return res.status(400).json({ error: "paymentType must be 'SINGLE' or 'BATCH'" });
  }

  try {
    const order = await prisma.order.findUnique({ where: { id } });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.isPaid) {
      return res.status(400).json({ error: "Order is already paid" });
    }

    const updated = await prisma.order.update({
      where: { id },
      data: {
        paymentMethod,
        isPaid: true,
        paidAt: new Date(),
        ...(paymentType ? { paymentType } : {}),
        ...(batchId ? { batchId } : {}),
      },
    });

    res.json(updated);
  } catch (e) {
    console.error("Error updating payment:", e);
    res.status(500).json({ error: "Failed to update payment" });
  }
});

// Void an order
router.post("/:id/void", async (req, res) => {
  const { id } = req.params;
  const { voidedById, reason } = req.body;

  if (!voidedById) {
    return res.status(400).json({ error: "voidedById is required" });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id },
      include: { OrderItem: true },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.isVoid) {
      return res.status(400).json({ error: "Order is already voided" });
    }

    // Check if order is in current open shift
    const currentShift = await prisma.shift.findFirst({
      where: { isOpen: true },
    });

    if (currentShift && order.shiftId && order.shiftId !== currentShift.id) {
      return res.status(400).json({ error: "Cannot void order from a different shift" });
    }

    const now = new Date();

    // Void order and restore plates
    const voidedOrder = await prisma.$transaction(async (tx) => {
      // Restore plates for each item
      for (const item of order.OrderItem) {
        const menu = await tx.menu.findUnique({ where: { id: item.menuId } });
        if (menu) {
          const currentStock = menu.stock ?? 0;
          await tx.menu.update({
            where: { id: item.menuId },
            data: {
              stock: currentStock + item.qty,
              isAvailable: true,
            },
          });
        }

        // Update shift snapshot if exists
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

      // Mark order as voided
      return tx.order.update({
        where: { id },
        data: {
          isVoid: true,
          voidReason: reason,
          voidedAt: now,
          voidedById,
        },
        include: { OrderItem: true },
      });
    });

    res.json(voidedOrder);
  } catch (e) {
    console.error("Error voiding order:", e);
    res.status(500).json({ error: "Failed to void order" });
  }
});

export default router;
