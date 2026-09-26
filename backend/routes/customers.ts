import { Router } from "express";
import prisma from "../db/db.js";

const router = Router();

function stripSpaces(s: string | undefined | null): string {
  return String(s ?? "").replace(/\s+/g, "");
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

// Express 4 does not catch rejected promises from async handlers, so an
// unhandled throw here would take the whole process down. Every :id route
// therefore rejects non-UUID ids up front and wraps its queries in try/catch.
function invalidId(res: import("express").Response, id: unknown): boolean {
  if (!isUuid(id)) {
    res.status(400).json({ error: "Customer id must be a valid UUID" });
    return true;
  }
  return false;
}

// GET /api/customers - List all customers with computed totals
router.get("/", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const where: any = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
    ];
  }
  const customers = await prisma.customer.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      orders: {
        where: {
          isPaid: false,
          isVoid: false,
        },
        select: {
          totalPrice: true,
        },
      },
    },
  });
  const result = customers.map((c) => {
    const openCount = c.orders.length;
    const outstanding = c.orders.reduce(
      (sum, o) => sum + Number(o.totalPrice ?? 0),
      0
    );
    return {
      ...c,
      openOrderCount: openCount,
      outstandingTotal: outstanding,
      orders: undefined,
    };
  });
  res.json(result);
});

// GET /api/customers/:id - Customer detail + ledger
// Splits the customer's orders into the three groups the detail page renders and
// returns a computed outstanding balance, so the page needs no client-side math.
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  if (invalidId(res, id)) return;
  try {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        orders: {
          include: {
            shift: { select: { type: true, operationDay: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const openOrders = customer.orders.filter((o) => !o.isPaid && !o.isVoid);
    const settledOrders = customer.orders.filter((o) => o.isPaid && !o.isVoid);
    const cancelledOrders = customer.orders.filter((o) => o.isVoid);
    const outstandingTotal = openOrders.reduce(
      (sum, o) => sum + Number(o.totalPrice ?? 0),
      0
    );

    // A replacement is a fresh order that does NOT inherit the customer, so the
    // reverse link has to be looked up explicitly to render "Replaced by #N".
    const voidedIds = cancelledOrders.map((o) => o.id);
    const replacements = voidedIds.length
      ? await prisma.order.findMany({
          where: { voidedOrderId: { in: voidedIds } },
          select: { voidedOrderId: true, orderNumber: true },
        })
      : [];
    const replacedByNumber = new Map(
      replacements
        .filter((r): r is { voidedOrderId: string; orderNumber: number } => !!r.voidedOrderId)
        .map((r) => [r.voidedOrderId, r.orderNumber])
    );

    const { orders: _all, ...rest } = customer;
    res.json({
      ...rest,
      orders: openOrders,
      settledOrders: settledOrders.map((o) => ({ ...o, replacedByOrderNumber: null })),
      cancelledOrders: cancelledOrders.map((o) => ({
        ...o,
        replacedByOrderNumber: replacedByNumber.get(o.id) ?? null,
      })),
      openOrderCount: openOrders.length,
      outstandingTotal,
    });
  } catch (e) {
    console.error("Error loading customer:", e);
    res.status(500).json({ error: "Failed to load customer" });
  }
});

// POST /api/customers - Create customer
router.post("/", async (req, res) => {
  const { name, phone, notes } = req.body;
  const strippedPhone = stripSpaces(phone);
  if (!name || String(name).trim().length === 0) {
    return res.status(400).json({ error: "name is required" });
  }
  if (!strippedPhone || strippedPhone.length === 0) {
    return res.status(400).json({ error: "phone is required" });
  }
  try {
    const customer = await prisma.customer.create({
      data: {
        name: String(name).trim(),
        phone: strippedPhone,
        notes: notes ? String(notes).trim() : undefined,
      },
    });
    res.status(201).json(customer);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(409).json({ error: "A customer with this phone already exists" });
    console.error("Error creating customer:", e);
    res.status(500).json({ error: "Failed to create customer" });
  }
});

// PUT /api/customers/:id - Update customer
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  if (invalidId(res, id)) return;
  const { name, phone, notes } = req.body;
  const strippedPhone = stripSpaces(phone);
  try {
    const customer = await prisma.customer.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(strippedPhone !== undefined && strippedPhone !== "" ? { phone: strippedPhone } : {}),
        ...(notes !== undefined && { notes: notes ? String(notes).trim() : null }),
      },
    });
    res.json(customer);
  } catch (e: any) {
    if (e.code === "P2025") return res.status(404).json({ error: "Customer not found" });
    if (e.code === "P2002") return res.status(409).json({ error: "A customer with this phone already exists" });
    console.error("Error updating customer:", e);
    res.status(500).json({ error: "Failed to update customer" });
  }
});

// DELETE /api/customers/:id - Delete (blocked if linked orders)
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  if (invalidId(res, id)) return;
  try {
    const linkedOrders = await prisma.order.findFirst({
      where: { customerId: id },
    });
    if (linkedOrders) {
      return res.status(409).json({ error: "Cannot delete a customer with linked orders" });
    }
    await prisma.customer.delete({ where: { id } });
    res.json({ message: "Customer deleted" });
  } catch (e: any) {
    if (e.code === "P2025") return res.status(404).json({ error: "Customer not found" });
    console.error("Error deleting customer:", e);
    res.status(500).json({ error: "Failed to delete customer" });
  }
});

export default router;
