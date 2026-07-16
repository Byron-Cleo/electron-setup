import { Router } from "express";
import prisma from "../db/db";
import { StockRequestStatus } from "../db/generated/prisma/client";

const router = Router();

const VALID_STATUSES = Object.values(StockRequestStatus) as string[];

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
          stockSupply: { select: { id: true, name: true, unit: true, currentStock: true } },
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
          stockSupply: { select: { id: true, name: true, unit: true, currentStock: true } },
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

  const request = await prisma.stockRequest.create({
    data: {
      requestedById,
      department,
      notes,
      status: StockRequestStatus.PENDING,
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
          stockSupply: { select: { id: true, name: true, unit: true, currentStock: true } },
        },
      },
    },
  });

  res.status(201).json(request);
});

// PUT /api/stock-requests/:id/fulfill - Store fulfills request items
router.put("/:id/fulfill", async (req, res) => {
  const { id } = req.params;
  const { items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "items[] is required" });
  }

  // Verify request exists
  const existing = await prisma.stockRequest.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!existing) return res.status(404).json({ error: "Request not found" });

  // Update each item's quantityDelivered
  for (const item of items) {
    if (!item.stockRequestItemId) continue;
    await prisma.stockRequestItem.update({
      where: { id: item.stockRequestItemId },
      data: { quantityDelivered: item.quantityDelivered ?? 0 },
    });
  }

  // Re-fetch to calculate status
  const updated = await prisma.stockRequest.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!updated) return res.status(404).json({ error: "Request not found after update" });

  // Auto-calculate status
  const allFullyDelivered = updated.items.every(
    (item) => Number(item.quantityDelivered) >= Number(item.quantityRequested)
  );
  const anyDelivered = updated.items.some(
    (item) => Number(item.quantityDelivered) > 0
  );

  let newStatus: StockRequestStatus;
  if (allFullyDelivered) {
    newStatus = StockRequestStatus.APPROVED;
  } else if (anyDelivered) {
    newStatus = StockRequestStatus.PARTIAL;
  } else {
    newStatus = StockRequestStatus.PENDING;
  }

  const finalRequest = await prisma.stockRequest.update({
    where: { id },
    data: { status: newStatus },
    include: {
      requestedBy: { select: { id: true, name: true } },
      items: {
        include: {
          stockSupply: { select: { id: true, name: true, unit: true, currentStock: true } },
        },
      },
    },
  });

  res.json(finalRequest);
});

export default router;
