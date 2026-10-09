import { Router } from "express";
import prisma from "../db/db.js";

const router = Router();

const VALID_STATUSES = ["PENDING", "PARTIAL", "COMPLETED"];

// GET /api/stock-requests/pending-count - Count pending requests (for sidebar badge)
router.get("/pending-count", async (_req, res) => {
  const count = await prisma.stockRequest.count({
    where: { status: "PENDING" },
  });
  res.json({ count });
});

// GET /api/stock-requests/partial-count - Count partial requests (for sidebar badge)
router.get("/partial-count", async (_req, res) => {
  const count = await prisma.stockRequest.count({
    where: { status: "PARTIAL" },
  });
  res.json({ count });
});

// GET /api/stock-requests - List all requests (optional ?status filter)
router.get("/", async (req, res) => {
  const { status } = req.query;
  const where: Record<string, unknown> = {};
  if (status && VALID_STATUSES.includes(status as string)) {
    where.status = status;
  }
  const requests = await prisma.stockRequest.findMany({
    where,
    include: {
      requestedBy: { select: { id: true, name: true } },
      items: {
        include: {
          stockSupply: { select: { id: true, name: true, unit: true, currentStock: true, image: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(requests);
});

// GET /api/stock-requests/:id - Get single request with items
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const request = await prisma.stockRequest.findUnique({
    where: { id },
    include: {
      requestedBy: { select: { id: true, name: true } },
      items: {
        include: {
          stockSupply: { select: { id: true, name: true, unit: true, currentStock: true, image: true } },
        },
      },
    },
  });
  if (!request) return res.status(404).json({ error: "Request not found" });
  res.json(request);
});

// POST /api/stock-requests - Create request (kitchen submits)
router.post("/", async (req, res) => {
  const { requestedById, department, notes, items } = req.body;

  if (!requestedById || !department || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "requestedById, department, and items[] are required" });
  }

  // Verify requester exists
  const user = await prisma.user.findUnique({ where: { id: requestedById } });
  if (!user) return res.status(400).json({ error: "Requester not found" });

  // Verify all stock supplies exist
  const supplyIds = items.map((item: { stockSupplyId: string }) => item.stockSupplyId);
  const supplies = await prisma.stockSupply.findMany({
    where: { id: { in: supplyIds }, isActive: true },
  });
  if (supplies.length !== supplyIds.length) {
    return res.status(400).json({ error: "One or more stock supplies not found or inactive" });
  }

  // Validate quantities
  for (const item of items) {
    if (!item.stockSupplyId || !item.quantityRequested || item.quantityRequested <= 0) {
      return res.status(400).json({ error: "Each item must have stockSupplyId and quantityRequested > 0" });
    }
  }

  // Validate stock availability
  for (const item of items) {
    const supply = supplies.find((s) => s.id === item.stockSupplyId)!;
    const available = Number(supply.currentStock);
    const requested = Number(item.quantityRequested);
    if (requested > available) {
      return res.status(400).json({
        error: `Insufficient stock for "${supply.name}". Available: ${available}, Requested: ${requested}`,
      });
    }
  }

  // Deduct stock and create request in a transaction
  const request = await prisma.$transaction(async (tx) => {
    // Deduct stock for each item
    for (const item of items) {
      await tx.stockSupply.update({
        where: { id: item.stockSupplyId },
        data: { currentStock: { decrement: item.quantityRequested } },
      });
    }

    // Create the request
    return tx.stockRequest.create({
      data: {
        requestedById,
        department,
        notes,
        status: "PENDING",
        items: {
          create: items.map((item: { stockSupplyId: string; quantityRequested: number }) => ({
            stockSupplyId: item.stockSupplyId,
            quantityRequested: item.quantityRequested,
          })),
        },
      },
      include: {
        requestedBy: { select: { id: true, name: true } },
        items: {
          include: {
            stockSupply: { select: { id: true, name: true, unit: true, currentStock: true, image: true } },
          },
        },
      },
    });
  });

  res.status(201).json(request);
});

// PUT /api/stock-requests/:id/fulfill - Store fulfills request items
router.put("/:id/fulfill", async (req, res) => {
  const { id } = req.params;
  const { fulfilledById, notes, items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "items[] is required" });
  }
  if (!fulfilledById) {
    return res.status(400).json({ error: "fulfilledById is required" });
  }

  // Verify request exists and is not already completed
  const existing = await prisma.stockRequest.findUnique({
    where: { id },
    include: { items: { include: { stockSupply: true } } },
  });
  if (!existing) return res.status(404).json({ error: "Request not found" });
  if (existing.status === "COMPLETED") {
    return res.status(400).json({ error: "Request is already completed" });
  }

  // Verify fulfiller exists
  const fulfiller = await prisma.user.findUnique({ where: { id: fulfilledById } });
  if (!fulfiller) return res.status(400).json({ error: "Fulfiller not found" });

  // Validate and collect fulfillment items
  const fulfillmentItems: { stockRequestItemId: string; quantityDelivered: number }[] = [];

  for (const item of items) {
    if (!item.stockRequestItemId || item.quantityDelivered === undefined) continue;

    const requestItem = existing.items.find((i) => i.id === item.stockRequestItemId);
    if (!requestItem) return res.status(400).json({ error: `Request item ${item.stockRequestItemId} not found` });

    const qty = Number(item.quantityDelivered);
    if (qty < 0) {
      return res.status(400).json({ error: "quantityDelivered cannot be negative" });
    }

    // Cannot deliver more than requested
    const totalAlreadyDelivered = Number(requestItem.quantityDelivered);
    const requested = Number(requestItem.quantityRequested);
    if (totalAlreadyDelivered + qty > requested) {
      return res.status(400).json({
        error: `Cannot deliver more than requested for "${requestItem.stockSupply.name}". Requested: ${requested}, Already delivered: ${totalAlreadyDelivered}`,
      });
    }

    if (qty > 0) {
      fulfillmentItems.push({ stockRequestItemId: item.stockRequestItemId, quantityDelivered: qty });
    }
  }

  if (fulfillmentItems.length === 0) {
    return res.status(400).json({ error: "Must deliver at least one item with quantity > 0" });
  }

  // Execute in a transaction: update request items, create fulfillment trail
  const result = await prisma.$transaction(async (tx) => {
    // Update request items
    for (const fi of fulfillmentItems) {
      // Update quantityDelivered on the request item
      await tx.stockRequestItem.update({
        where: { id: fi.stockRequestItemId },
        data: { quantityDelivered: { increment: fi.quantityDelivered } },
      });
    }

    // Create fulfillment record
    await tx.stockFulfillment.create({
      data: {
        stockRequestId: id,
        fulfilledById,
        notes,
        items: {
          create: fulfillmentItems.map((fi) => ({
            stockRequestItemId: fi.stockRequestItemId,
            quantityDelivered: fi.quantityDelivered,
          })),
        },
      },
    });

    // Re-fetch to calculate status
    const updated = await tx.stockRequest.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!updated) throw new Error("Request not found after update");

    // Auto-calculate status (only goes forward)
    const allFullyDelivered = updated.items.every(
      (item) => Number(item.quantityDelivered) >= Number(item.quantityRequested)
    );
    const anyDelivered = updated.items.some(
      (item) => Number(item.quantityDelivered) > 0
    );

    let newStatus: "PENDING" | "PARTIAL" | "COMPLETED";
    if (allFullyDelivered) {
      newStatus = "COMPLETED";
    } else if (anyDelivered) {
      newStatus = "PARTIAL";
    } else {
      newStatus = "PENDING";
    }

    // Only allow forward status transitions
    const statusOrder = { PENDING: 0, PARTIAL: 1, COMPLETED: 2 };
    if (statusOrder[newStatus] < statusOrder[existing.status]) {
      newStatus = existing.status;
    }

    const finalRequest = await tx.stockRequest.update({
      where: { id },
      data: { status: newStatus },
      include: {
        requestedBy: { select: { id: true, name: true } },
        items: {
          include: {
            stockSupply: { select: { id: true, name: true, unit: true, currentStock: true, image: true } },
          },
        },
        fulfillments: {
          include: {
            fulfilledBy: { select: { id: true, name: true } },
            items: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return finalRequest;
  });

  res.json(result);
});

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

// PUT /api/stock-requests/:id/adjust - Kitchen adjusts a requested amount while
// the stock is still raw. new >= delivered is a pure request change (the store
// shelf is refunded/charged the difference); new < delivered hands the uncooked
// surplus back to the store as a StockReturn row, capped by the supply's
// uncooked remainder — cooked stock can never be returned. Status recomputes
// freely: unlike fulfilment, raising the amount can reopen a completed request.
router.put("/:id/adjust", async (req, res) => {
  const { id } = req.params;
  const { adjustedById, notes, items } = req.body;

  if (!adjustedById) return res.status(400).json({ error: "adjustedById is required" });
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "items[] is required" });
  }

  const existing = await prisma.stockRequest.findUnique({
    where: { id },
    include: { items: { include: { stockSupply: true } } },
  });
  if (!existing) return res.status(404).json({ error: "Request not found" });

  // Adjust lock: pending/partial requests are always adjustable, but a
  // COMPLETED request only stays adjustable through the day it was last
  // touched (updatedAt, Nairobi date). Completed on a past date is closed
  // history — Prisma bumps updatedAt on every touch, so a request completed
  // today keeps its allowance window and auto-locks tomorrow.
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
  const touchedStr = new Date(existing.updatedAt).toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
  if (existing.status === "COMPLETED" && touchedStr !== todayStr) {
    return res.status(400).json({
      error: `Request was completed on a past date (${touchedStr}) and can no longer be adjusted`,
    });
  }

  const adjuster = await prisma.user.findUnique({ where: { id: adjustedById } });
  if (!adjuster) return res.status(400).json({ error: "Adjuster not found" });

  // Validate everything up front so the transaction never half-applies.
  const pending: {
    itemId: string;
    stockSupplyId: string;
    next: number;
    refund: number;
    charge: number;
    returnQty: number;
  }[] = [];
  const remainders = new Map<string, number>();
  const charges = new Map<string, number>();

  for (const body of items) {
    if (!body.stockRequestItemId || body.quantityRequested === undefined) {
      return res.status(400).json({ error: "Each item must have stockRequestItemId and quantityRequested" });
    }
    const item = existing.items.find((i) => i.id === body.stockRequestItemId);
    if (!item) {
      return res.status(400).json({ error: `Request item ${body.stockRequestItemId} not found` });
    }

    const next = Number(body.quantityRequested);
    if (!Number.isFinite(next) || next <= 0) {
      return res.status(400).json({
        error: `New quantity for "${item.stockSupply.name}" must be more than 0 (decimals allowed)`,
      });
    }

    const old = Number(item.quantityRequested);
    const delivered = Number(item.quantityDelivered);

    if (next >= delivered) {
      const charge = next > old ? next - old : 0;
      if (charge > 0) {
        // Two items of the same supply can both grow — gate the SUM against
        // the shelf, not each item in isolation.
        const soFar = charges.get(item.stockSupplyId) ?? 0;
        const available = Number(item.stockSupply.currentStock);
        if (soFar + charge > available) {
          return res.status(400).json({
            error: `Insufficient stock to increase "${item.stockSupply.name}". Available: ${available}, Extra needed: ${soFar + charge}`,
          });
        }
        charges.set(item.stockSupplyId, soFar + charge);
      }
      pending.push({
        itemId: item.id,
        stockSupplyId: item.stockSupplyId,
        next,
        refund: next < old ? old - next : 0,
        charge,
        returnQty: 0,
      });
    } else {
      // Implicit return of the delivered surplus, capped by the uncooked
      // remainder. The cache also shrinks per item so several items of the
      // same supply can never together return more than the remainder.
      const returnQty = delivered - next;
      let remainder = remainders.get(item.stockSupplyId);
      if (remainder === undefined) {
        remainder = await uncookedRemainder(item.stockSupplyId);
        remainders.set(item.stockSupplyId, remainder);
      }
      if (returnQty > remainder) {
        return res.status(400).json({
          error: `Cannot return more than the uncooked remainder for "${item.stockSupply.name}". Returnable: ${remainder}`,
        });
      }
      remainders.set(item.stockSupplyId, remainder - returnQty);
      pending.push({
        itemId: item.id,
        stockSupplyId: item.stockSupplyId,
        next,
        refund: 0,
        charge: 0,
        returnQty,
      });
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    for (const p of pending) {
      if (p.refund > 0) {
        await tx.stockSupply.update({
          where: { id: p.stockSupplyId },
          data: { currentStock: { increment: p.refund } },
        });
        await tx.stockRequestItem.update({
          where: { id: p.itemId },
          data: { quantityRequested: p.next },
        });
      } else if (p.charge > 0) {
        await tx.stockSupply.update({
          where: { id: p.stockSupplyId },
          data: { currentStock: { decrement: p.charge } },
        });
        await tx.stockRequestItem.update({
          where: { id: p.itemId },
          data: { quantityRequested: p.next },
        });
      } else if (p.returnQty > 0) {
        await tx.stockSupply.update({
          where: { id: p.stockSupplyId },
          data: { currentStock: { increment: p.returnQty } },
        });
        await tx.stockRequestItem.update({
          where: { id: p.itemId },
          data: { quantityRequested: p.next, quantityDelivered: p.next },
        });
        await tx.stockReturn.create({
          data: {
            stockSupplyId: p.stockSupplyId,
            stockRequestItemId: p.itemId,
            quantityReturned: p.returnQty,
            returnedById: adjustedById,
            notes,
          },
        });
      }
    }

    const updated = await tx.stockRequest.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!updated) throw new Error("Request not found after adjust");

    // Recompute freely — adjust can move a request backwards (raising the
    // amount reopens a completed request).
    const allFullyDelivered = updated.items.every(
      (item) => Number(item.quantityDelivered) >= Number(item.quantityRequested),
    );
    const anyDelivered = updated.items.some((item) => Number(item.quantityDelivered) > 0);
    const newStatus = allFullyDelivered ? "COMPLETED" : anyDelivered ? "PARTIAL" : "PENDING";

    return tx.stockRequest.update({
      where: { id },
      data: { status: newStatus },
      include: {
        requestedBy: { select: { id: true, name: true } },
        items: {
          include: {
            stockSupply: { select: { id: true, name: true, unit: true, currentStock: true, image: true } },
          },
        },
        fulfillments: {
          include: {
            fulfilledBy: { select: { id: true, name: true } },
            items: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
  });

  res.json(result);
});

export default router;
