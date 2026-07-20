import { Router } from "express";
import prisma from "../db/db";

const router = Router();

const VALID_STATUSES = ["PENDING", "PARTIAL", "COMPLETED"];

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

export default router;
