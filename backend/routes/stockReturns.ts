import { Router } from "express";
import prisma from "../db/db.js";

const router = Router();

// Uncooked remainder for a supply: everything ever delivered to the kitchen
// minus everything cooked minus everything already returned. This is the only
// raw stock that can physically go back to the store — clamped at 0 because
// cooked > delivered means the kitchen owes stock, not the other way round.
async function uncookedRemainder(stockSupplyId: string): Promise<number> {
  const [deliveredAgg, cookedAgg, returnedAgg] = await Promise.all([
    prisma.stockFulfillmentItem.aggregate({
      _sum: { quantityDelivered: true },
      where: { stockRequestItem: { stockSupplyId } },
    }),
    prisma.cookingRecord.aggregate({
      _sum: { quantityCooked: true },
      where: { stockSupplyId },
    }),
    prisma.stockReturn.aggregate({
      _sum: { quantityReturned: true },
      where: { stockSupplyId },
    }),
  ]);
  const delivered = Number(deliveredAgg._sum.quantityDelivered ?? 0);
  const cooked = Number(cookedAgg._sum.quantityCooked ?? 0);
  const returned = Number(returnedAgg._sum.quantityReturned ?? 0);
  return Math.max(0, delivered - cooked - returned);
}

// GET /api/stock-returns - Return ledger, newest first
router.get("/", async (_req, res) => {
  const returns = await prisma.stockReturn.findMany({
    include: {
      stockSupply: { select: { id: true, name: true, unit: true } },
      returnedBy: { select: { id: true, name: true } },
      stockRequestItem: { select: { id: true, stockRequestId: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(returns);
});

// POST /api/stock-returns - Kitchen returns an uncooked remainder to the store
router.post("/", async (req, res) => {
  const { stockSupplyId, quantityReturned, returnedById, notes } = req.body;

  if (!stockSupplyId || !returnedById || quantityReturned === undefined) {
    return res.status(400).json({ error: "stockSupplyId, quantityReturned, and returnedById are required" });
  }

  const supply = await prisma.stockSupply.findUnique({ where: { id: stockSupplyId } });
  if (!supply || !supply.isActive) {
    return res.status(400).json({ error: "Stock supply not found or inactive" });
  }

  const user = await prisma.user.findUnique({ where: { id: returnedById } });
  if (!user) return res.status(400).json({ error: "User not found" });

  const qty = Number(quantityReturned);
  if (!Number.isFinite(qty) || qty <= 0) {
    return res.status(400).json({ error: "quantityReturned must be more than 0 (decimals allowed)" });
  }

  const remainder = await uncookedRemainder(stockSupplyId);
  if (qty > remainder) {
    return res.status(400).json({
      error: `Cannot return more than the uncooked remainder for "${supply.name}". Returnable: ${remainder}`,
    });
  }

  const result = await prisma.$transaction(async (tx) => {
    const row = await tx.stockReturn.create({
      data: { stockSupplyId, stockRequestItemId: null, quantityReturned: qty, returnedById, notes },
      include: {
        stockSupply: { select: { id: true, name: true, unit: true } },
        returnedBy: { select: { id: true, name: true } },
        stockRequestItem: { select: { id: true, stockRequestId: true } },
      },
    });
    await tx.stockSupply.update({
      where: { id: stockSupplyId },
      data: { currentStock: { increment: qty } },
    });
    return row;
  });

  res.status(201).json(result);
});

export default router;
