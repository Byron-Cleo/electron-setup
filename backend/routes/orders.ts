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
  const { userId, items, mealType } = req.body;

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

  try {
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
          paymentMethod: "cash",
          itemsPrice,
          shippingPrice,
          taxPrice,
          totalPrice,
          mealType,
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
      }

      return tx.order.findUnique({
        where: { id: created.id },
        include: { OrderItem: true },
      });
    });

    res.status(201).json(order);
  } catch (e: any) {
    if (e.code === "P2025") {
      return res.status(404).json({ error: "Menu item not found" });
    }
    console.error("Error creating order:", e);
    res.status(500).json({ error: "Failed to create order" });
  }
});

export default router;
