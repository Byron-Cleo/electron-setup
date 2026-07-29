import { Router } from "express";
import prisma from "../db/db";

const router = Router();

// GET /api/kitchen/inventory - Kitchen inventory with PENDING stock items (isMenuStock = true)
router.get("/", async (req, res) => {
  // Get all stock supplies with isMenuStock = true
  const stockSupplies = await prisma.stockSupply.findMany({
    where: {
      isMenuStock: true,
      isActive: true,
    },
    include: {
      menus: { include: { menu: { select: { id: true, name: true, slug: true, images: true } } } },
    },
    orderBy: { name: "asc" },
  });

  // For each item, calculate inventory metrics
  const inventory = await Promise.all(
    stockSupplies.map(async (item) => {
      // All fulfillments for this stock supply, oldest first
      const fulfillments = await prisma.stockFulfillmentItem.findMany({
        where: { stockRequestItem: { stockSupplyId: item.id } },
        orderBy: { createdAt: "asc" },
        select: { quantityDelivered: true },
      });

      // Total all-time cooked
      const totalCookedAllTime = await prisma.cookingRecord.aggregate({
        _sum: { quantityCooked: true },
        where: { stockSupplyId: item.id },
      });

      // Walk through fulfillments oldest-first, consuming them against cooked amount
      let remainingToConsume = Number(totalCookedAllTime._sum.quantityCooked ?? 0)
      let activeOrdered = 0
      let activeCooked = 0

      for (const f of fulfillments) {
        const qty = Number(f.quantityDelivered)
        if (remainingToConsume >= qty) {
          // This fulfillment is fully consumed by cooking
          remainingToConsume -= qty
        } else {
          // This fulfillment is partially or not yet consumed — it's the active batch
          const consumedFromThis = remainingToConsume
          activeOrdered += qty
          activeCooked += consumedFromThis
          remainingToConsume = 0
        }
      }

      // Plates made = activeCooked × platesPerUnit (configured yield)
      const totalPlatesProduced = Number(item.platesPerUnit ?? 0) * activeCooked

      const rawStockPending = activeOrdered - activeCooked

      // Get the latest cooking record date for this item
      const latestRecord = await prisma.cookingRecord.findFirst({
        where: { stockSupplyId: item.id },
        orderBy: { cookedDate: "desc" },
        select: { cookedDate: true },
      });

      return {
        id: item.id,
        name: item.name,
        slug: item.slug,
        unit: item.unit,
        lastCookedDate: latestRecord?.cookedDate.toISOString() ?? null,
        platesPerUnit: item.platesPerUnit,
        image: item.image,
        menus: item.menus.map((sm) => sm.menu),
        totalOrdered: activeOrdered,
        totalCooked: activeCooked,
        rawStockPending,
        totalPlatesProduced,
      };
    })
  );

  res.json(inventory);
});

export default router;
