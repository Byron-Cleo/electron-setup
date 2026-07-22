import { Router } from "express";
import prisma from "../db/db";

const router = Router();

// GET /api/kitchen/inventory - Kitchen inventory with PENDING stock items (isMenuStock = true)
router.get("/", async (_req, res) => {
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
      // Total fulfilled (received from store)
      const totalFulfilled = await prisma.stockFulfillmentItem.aggregate({
        _sum: { quantityDelivered: true },
        where: { stockRequestItem: { stockSupplyId: item.id } },
      });

      // Total cooked (consumed in kitchen)
      const totalCooked = await prisma.cookingRecord.aggregate({
        _sum: { quantityCooked: true },
        where: { stockSupplyId: item.id },
      });

      // Total plates produced (actual or expected)
      const records = await prisma.cookingRecord.findMany({
        where: { stockSupplyId: item.id },
        select: { platesActual: true, platesExpected: true },
      });
      const totalPlatesProduced = records.reduce(
        (sum, r) => sum + Number(r.platesActual ?? r.platesExpected),
        0
      );

      const received = Number(totalFulfilled._sum.quantityDelivered ?? 0);
      const cooked = Number(totalCooked._sum.quantityCooked ?? 0);
      const rawStockPending = received - cooked;

      return {
        id: item.id,
        name: item.name,
        slug: item.slug,
        unit: item.unit,
        platesPerUnit: item.platesPerUnit,
        image: item.image,
        menus: item.menus.map((sm) => sm.menu),
        totalOrdered: received,
        totalCooked: cooked,
        rawStockPending,
        totalPlatesProduced,
      };
    })
  );

  res.json(inventory);
});

export default router;
