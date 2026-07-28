import { Router } from "express";
import prisma from "../db/db";

const router = Router();

// GET /api/kitchen/inventory - Kitchen inventory with PENDING stock items (isMenuStock = true)
// Optional ?date=YYYY-MM-DD to filter cooking records to a specific date
router.get("/", async (req, res) => {
  const { date } = req.query;
  let dateFilter: Record<string, unknown> = {}
  if (date) {
    const d = new Date(date as string)
    if (isNaN(d.getTime())) {
      return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" })
    }
    const nextDay = new Date(d)
    nextDay.setDate(nextDay.getDate() + 1)
    dateFilter.cookedDate = { gte: d, lt: nextDay }
  }

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

      // Total cooked (consumed in kitchen) — filtered by date if provided
      const cookingWhere: Record<string, unknown> = { stockSupplyId: item.id }
      if (date) {
        cookingWhere.cookedDate = dateFilter.cookedDate
      }
      const totalCooked = await prisma.cookingRecord.aggregate({
        _sum: { quantityCooked: true },
        where: cookingWhere,
      });

      // Total plates produced (actual or expected) — filtered by date if provided
      const records = await prisma.cookingRecord.findMany({
        where: cookingWhere,
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
