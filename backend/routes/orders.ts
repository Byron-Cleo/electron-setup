import { Router } from "express";
import prisma from "../db/db.js";
import { emitLiveEvent } from "../events.js";
import { type Prisma, ServiceTime } from "../db/generated/prisma/client.js";

const router = Router();

// Every `*ById` column is a uuid, so a malformed value would otherwise surface
// as an opaque Prisma P2007 500.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

// Build operationDay as UTC midnight of the local calendar date, matching the
// scheduler's dateOnly convention so order attribution aligns with shift dates.
function dateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

// Recompute Menu.stock = sum of split platesRemaining (aligns direct mutation with split truth)
async function recomputeMenuStock(tx: Prisma.TransactionClient, menuId: string) {
  const agg = await tx.cookingRecordMenu.aggregate({
    _sum: { platesRemaining: true },
    where: { menuId },
  });
  const total = Number(agg._sum?.platesRemaining ?? 0);
  await tx.menu.update({ where: { id: menuId }, data: { stock: total } });
  return total;
}

router.get("/count", async (_req, res) => {
  try {
    const count = await prisma.order.count();
    res.json({ count });
  } catch (e) {
    console.error("Error counting orders:", e);
    res.status(500).json({ error: "Failed to count orders" });
  }
});

router.get("/unpaid-count", async (_req, res) => {
  try {
    // Unpaid backlog: orders the customer walked out on, whether or not a
    // customer has since been attached. Deliberately excludes unmarked orders
    // still pending collection on the running shift, so the badge reads 0
    // during quiet service and only rises when money is actually owed.
    const count = await prisma.order.count({
      where: { unpaidAcknowledged: true, isPaid: false, isVoid: false },
    });
    res.json({ count });
  } catch (e) {
    console.error("Error counting unpaid orders:", e);
    res.status(500).json({ error: "Failed to count unpaid orders" });
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
        Customer: { select: { id: true, name: true, phone: true } },
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

  // Every order must link to an open shift (no orphaned orders) and should be
  // attributed to the shift of the CURRENT operation day. This keeps all
  // shift-scoped workflows (manual close, unpaid enforcement, reports) aligned
  // with the order's operation date. Fall back to the newest open shift (same
  // rule as getCurrentShift) only when today's shift has not opened yet, so an
  // order never lands on a stale previous-day shift while the current cycle's
  // shift exists.
  const operationDay = dateOnly(new Date());
  const currentShift =
    (await prisma.shift.findFirst({
      where: { isOpen: true, operationDay },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    })) ??
    (await prisma.shift.findFirst({
      where: { isOpen: true },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }));
  if (!currentShift) {
    return res.status(400).json({ error: "No active shift. The system cannot take orders without an active shift. Please contact the manager." });
  }

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
          shiftId: currentShift.id,
        },
      });

      for (let i = 0; i < lines.length; i++) {
        const item = lines[i];
        const orderItem = await tx.orderItem.create({
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
        // Atomic guarded decrement: only succeeds if sufficient stock exists (prevents race/over-sell)
        const updated = await tx.menu.updateMany({
          where: { id: item.menuId, stock: { gte: item.qty } },
          data: { stock: { decrement: item.qty } },
        });
        if (updated.count === 0) {
          throw new Error(`Insufficient stock for ${item.name}: only ${currentStock} plates remaining`);
        }

        // Decrement the menu's split platesRemaining in lock-step with Menu.stock
        // (FIFO across the menu's splits, never below 0) - record allocations
        let toDeduct = item.qty;
        const activeSplits = await tx.cookingRecordMenu.findMany({
          where: { menuId: item.menuId, platesRemaining: { gt: 0 } },
          orderBy: { createdAt: "asc" },
          include: { cookingRecord: true },
        });
        for (const split of activeSplits) {
          if (toDeduct <= 0) break;
          const deductNow = Math.min(Number(split.platesRemaining), toDeduct);
          await tx.cookingRecordMenu.update({
            where: { id: split.id },
            data: { platesRemaining: { decrement: deductNow } },
          });
          await tx.orderItemAllocation.create({
            data: {
              orderItemId: orderItem.id,
              cookingRecordId: split.cookingRecordId,
              cookingRecordMenuId: split.id,
              plates: deductNow,
            },
          });
          toDeduct -= deductNow;
        }

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
        // Align Menu.stock with split truth after order creation
        await recomputeMenuStock(tx, item.menuId);
      }

      return tx.order.findUnique({
        where: { id: created.id },
        include: { OrderItem: true },
      });
    });

    emitLiveEvent({
      type: "order.created",
      orderId: order?.id,
      shiftId: order?.shiftId ?? currentShift.id,
      at: new Date().toISOString(),
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

    emitLiveEvent({
      type: "order.paid",
      orderId: updated.id,
      shiftId: updated.shiftId ?? undefined,
      at: new Date().toISOString(),
    });
    res.json(updated);
  } catch (e) {
    console.error("Error updating payment:", e);
    res.status(500).json({ error: "Failed to update payment" });
  }
});

// Mark an order as acknowledged-unpaid (manager confirmation; NOT a void).
// Once marked, it no longer blocks the shift from closing and is reported in
// the shift's payment summary as an unpaid tracked order.
router.post("/:id/unpaid-ack", async (req, res) => {
  const { id } = req.params;
  const { acknowledgedById, customerId } = req.body;

  if (!acknowledgedById) {
    return res.status(400).json({ error: "acknowledgedById is required" });
  }
  if (!isUuid(acknowledgedById)) {
    return res.status(400).json({ error: "acknowledgedById must be a valid user id" });
  }

  try {
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.isPaid) {
      return res.status(400).json({ error: "Only unpaid orders can be marked as unpaid" });
    }
    if (order.isVoid) {
      return res.status(400).json({ error: "Voided orders cannot be marked as unpaid" });
    }

    const updateData: any = {
        unpaidAcknowledged: true,
        unpaidAcknowledgedById: acknowledgedById,
        unpaidAcknowledgedAt: new Date(),
      };
    if (customerId) {
      const customerExists = await prisma.customer.findUnique({ where: { id: customerId } });
      if (!customerExists) {
        return res.status(404).json({ error: "Customer not found" });
      }
      updateData.customerId = customerId;
      updateData.customerAssignedById = acknowledgedById;
      updateData.customerAssignedAt = new Date();
    }
    const updated = await prisma.order.update({
      where: { id },
      data: updateData,
    });
    emitLiveEvent({
      type: "order.unpaid-ack",
      orderId: updated.id,
      shiftId: updated.shiftId ?? undefined,
      at: new Date().toISOString(),
    });
    res.json(updated);
  } catch (e) {
    console.error("Error acknowledging unpaid order:", e);
    res.status(500).json({ error: "Failed to acknowledge unpaid order" });
  }
});

// Undo an unpaid acknowledgement (reopens the close-block if currently closing)
router.post("/:id/unpaid-ack-undo", async (req, res) => {
  const { id } = req.params;

  try {
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (!order.unpaidAcknowledged) {
      return res.status(400).json({ error: "Order is not marked as unpaid" });
    }

    const updated = await prisma.order.update({
      where: { id },
      data: {
        unpaidAcknowledged: false,
        unpaidAcknowledgedById: null,
        unpaidAcknowledgedAt: null,
        customerId: null,
        customerAssignedById: null,
        customerAssignedAt: null,
      },
    });
    emitLiveEvent({
      type: "order.unpaid-ack-undo",
      orderId: updated.id,
      shiftId: updated.shiftId ?? undefined,
      at: new Date().toISOString(),
    });
    res.json(updated);
  } catch (e) {
    console.error("Error undoing unpaid acknowledgement:", e);
    res.status(500).json({ error: "Failed to undo unpaid acknowledgement" });
  }
});

router.post("/:id/assign-customer", async (req, res) => {
  const { id } = req.params;
  const { customerId, assignedById } = req.body;

  if (!customerId) return res.status(400).json({ error: "customerId is required" });
  if (!assignedById) return res.status(400).json({ error: "assignedById is required" });
  if (!isUuid(customerId) || !isUuid(assignedById)) {
    return res.status(400).json({ error: "customerId and assignedById must be valid ids" });
  }

  try {
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.isPaid) return res.status(400).json({ error: "Only unpaid orders can be assigned a customer" });
    if (order.isVoid) return res.status(400).json({ error: "Voided orders cannot be assigned a customer" });
    if (!order.unpaidAcknowledged) return res.status(400).json({ error: "Only orders marked as unpaid can be assigned a customer" });

    const customerExists = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customerExists) return res.status(404).json({ error: "Customer not found" });

    const updated = await prisma.order.update({
      where: { id },
      data: {
        customerId,
        customerAssignedById: assignedById,
        customerAssignedAt: new Date(),
      },
    });
    emitLiveEvent({ type: "order.customer-assigned", orderId: updated.id, shiftId: updated.shiftId ?? undefined, at: new Date().toISOString() });
    res.json(updated);
  } catch (e) {
    console.error("Error assigning customer:", e);
    res.status(500).json({ error: "Failed to assign customer" });
  }
});

router.post("/:id/unassign-customer", async (req, res) => {
  const { id } = req.params;
  try {
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.isPaid) return res.status(400).json({ error: "Paid orders cannot be unassigned" });

    const updated = await prisma.order.update({
      where: { id },
      data: {
        customerId: null,
        customerAssignedById: null,
        customerAssignedAt: null,
      },
    });
    emitLiveEvent({ type: "order.customer-unassigned", orderId: updated.id, shiftId: updated.shiftId ?? undefined, at: new Date().toISOString() });
    res.json(updated);
  } catch (e) {
    console.error("Error unassigning customer:", e);
    res.status(500).json({ error: "Failed to unassign customer" });
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
      orderBy: { createdAt: "desc" },
    });

    if (currentShift && order.shiftId && order.shiftId !== currentShift.id) {
      return res.status(400).json({ error: "Cannot void order from a different shift" });
    }
    // Block void of a shiftless (orphaned) order when a current shift is open
    if (currentShift && !order.shiftId) {
      return res.status(400).json({ error: "Cannot void an unshifted order while a shift is open" });
    }

    const now = new Date();

    // Void order and restore plates
    const voidedOrder = await prisma.$transaction(async (tx) => {
      // Restore plates for each item
      for (const item of order.OrderItem) {
        const menu = await tx.menu.findUnique({ where: { id: item.menuId } });
        if (!menu) {
          console.warn(`Menu item ${item.menuId} not found during void; stock restoration skipped for this item`);
        } else {
          const currentStock = menu.stock ?? 0;
          await tx.menu.update({
            where: { id: item.menuId },
            data: {
              stock: currentStock + item.qty,
            },
          });
        }

        // Delete allocations for this order item and restore plates to splits (FIFO reverse - restore to splits that were consumed? but we don't track; easier: just restore by consuming from the allocations we created? 
        // But to keep simple: delete allocations for this item and restore plates to splits - but we need to know which splits to restore to. 
        // Alternatively, look up allocations and restore to those split ids in reverse order of creation? Since allocations created in order of consumption (FIFO), restoring to same splits)
        const allocations = await tx.orderItemAllocation.findMany({
          where: { orderItemId: item.id },
          orderBy: { createdAt: "desc" },
        });
        for (const alloc of allocations) {
          await tx.cookingRecordMenu.update({
            where: { id: alloc.cookingRecordMenuId! },
            data: { platesRemaining: { increment: Number(alloc.plates) } },
          });
        }
        await tx.orderItemAllocation.deleteMany({
          where: { orderItemId: item.id },
        });

        // Align Menu.stock with split truth after void restoration
        await recomputeMenuStock(tx, item.menuId);

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

    emitLiveEvent({
      type: "order.voided",
      orderId: voidedOrder.id,
      shiftId: voidedOrder.shiftId ?? undefined,
      at: new Date().toISOString(),
    });
    res.json(voidedOrder);
  } catch (e) {
    console.error("Error voiding order:", e);
    res.status(500).json({ error: "Failed to void order" });
  }
});

export default router;
