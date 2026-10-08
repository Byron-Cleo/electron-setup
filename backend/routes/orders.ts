import { Router } from "express";
import prisma from "../db/db.js";
import { emitLiveEvent } from "../events.js";
import { ServiceTime } from "../db/generated/prisma/client.js";
import {
  InsufficientPoolError,
  assertLinesServable,
  consumeForOrderItem,
  factorForServing,
  recomputeMenuStockWithSiblings,
  restoreForOrderItem,
  round2,
  sellableForMenu,
} from "../pools.js";

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

// The shift new orders attach to — shared by order creation and the void
// guard so both always agree. A shift still inside its allowed drift window
// is the one actually serving, so orders attach to IT (the oldest such shift
// if several), keeping snapshot tallies, unpaid scoping and close-gate
// figures coherent with the window-based report attribution. Once it closes
// (manually or at its drift deadline), attachment falls back to the newest
// open shift of the current operation day.
async function resolveCurrentShift(): Promise<{ id: string } | null> {
  const now = new Date();

  const drifting = await prisma.shift.findMany({
    where: {
      isOpen: true,
      autoClosed: true,
      finalCloseSource: null,
      autoCloseTime: { lte: now },
    },
    orderBy: { autoOpenTime: "asc" },
    select: { id: true, type: true, autoCloseTime: true },
  });

  if (drifting.length > 0) {
    const configs = await prisma.shiftConfig.findMany({
      where: { type: { in: drifting.map((s) => s.type) } },
    });
    const policyByType = new Map(configs.map((c) => [c.type, c]));
    for (const candidate of drifting) {
      const cfg = policyByType.get(candidate.type);
      if (cfg?.manual !== true) continue; // auto shifts never sit open in drift
      if (cfg.strictClose) continue; // strict shifts never sit open
      if (cfg.maxDriftMinutes === null || cfg.maxDriftMinutes === undefined) {
        return candidate; // unlimited — in its drift until closed
      }
      if (now.getTime() <= candidate.autoCloseTime.getTime() + cfg.maxDriftMinutes * 60_000) {
        return candidate;
      }
    }
  }

  const operationDay = dateOnly(now);
  return (
    (await prisma.shift.findFirst({
      where: { isOpen: true, operationDay },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    })) ??
    (await prisma.shift.findFirst({
      where: { isOpen: true },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }))
  );
}

// `Menu.stock` is a mirror maintained by recomputeMenuStock() in pools.ts —
// which knows about both engines and weighted portions. It is deliberately not
// decremented here.

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

  // Portion is part of the line's identity: one dish ordered as 1pc and as 2pc
// is two different lines (they cost different amounts of pool), matching the
// OrderItem unique index.
const lineKey = (item: {
    menuId: string;
    starchId?: string | null;
    vegetableId?: string | null;
    portionId?: string | null;
  }) => `${item.menuId}|${item.starchId ?? ""}|${item.vegetableId ?? ""}|${item.portionId ?? ""}`;
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

  // Every order must link to an open shift (no orphaned orders) and is
  // attributed to the shift actually serving at placement time — a shift
  // inside its allowed drift window wins over the newest open shift (see
  // resolveCurrentShift), so attachment matches the report's window
  // attribution. Fall back to the newest open shift of the current operation
  // day once nothing is drifting.
  const currentShift = await resolveCurrentShift();
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
      const resolvedAccompaniments: { starchId: string | null; vegetableId: string | null; portionId: string | null }[] = [];
      // Resolved unit price per line (portion-aware), persisted on the OrderItem
      // so the stored line price matches the order total exactly.
      const lineUnitPrices: number[] = [];
      for (const item of lines) {
        const [starch, vegetable, portion] = await Promise.all([
          item.starchId
            ? tx.menuAccompaniment.findUnique({ where: { id: item.starchId }, select: { price: true } })
            : Promise.resolve(null),
          item.vegetableId
            ? tx.menuAccompaniment.findUnique({ where: { id: item.vegetableId }, select: { price: true } })
            : Promise.resolve(null),
          item.portionId
            ? tx.menuAccompaniment.findUnique({
                where: { id: item.portionId },
                select: { price: true, category: true },
              })
            : Promise.resolve(null),
        ]);
        // A portion prices the serving (2 eggs is not "1 egg plus 1"), so its
        // price replaces the dish price rather than adding to it.
        // Prefer the DB price for a portion; otherwise trust the client's dish
        // price. `basePrice` is what the order total below is built from, and it
        // is ALSO what gets persisted on the line (see orderItem.create), so the
        // stored line price and the order total can never disagree.
        const basePrice = portion?.category === "PORTION" ? Number(portion.price ?? 0) : Number(item.price);
        itemsPrice += (basePrice + Number(starch?.price ?? 0) + Number(vegetable?.price ?? 0)) * item.qty;
        lineUnitPrices.push(basePrice);
        resolvedAccompaniments.push({
          starchId: starch ? item.starchId ?? null : null,
          vegetableId: vegetable ? item.vegetableId ?? null : null,
          portionId: portion?.category === "PORTION" ? item.portionId ?? null : null,
        });
      }
      const totalPrice = itemsPrice + shippingPrice + taxPrice;

      // Fail the whole order before writing anything, so the waiter is told
      // about every shortfall at once and a rejection leaves no partial state.
      await assertLinesServable(
        tx,
        lines.map((item, i) => ({
          menuId: item.menuId,
          name: item.name,
          qty: item.qty,
          portionId: resolvedAccompaniments[i]?.portionId ?? null,
        })),
      );

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
            price: lineUnitPrices[i] ?? item.price,
            name: item.name,
            slug: item.slug,
            image: item.image,
            starchId: resolvedAccompaniments[i]?.starchId ?? null,
            vegetableId: resolvedAccompaniments[i]?.vegetableId ?? null,
            portionId: resolvedAccompaniments[i]?.portionId ?? null,
          },
        });

        // Opening balance for the shift snapshot, taken before this sale.
        const sellableBefore = await sellableForMenu(tx, item.menuId);
        // Charge the weighted cost of this serving (1 plate, or 0.5 for a half,
        // or 2 for a two-piece portion) and drain FIFO across both engines.
        const factor = await factorForServing(
          tx,
          item.menuId,
          resolvedAccompaniments[i]?.portionId ?? null,
        );
        await consumeForOrderItem(tx, orderItem.id, item.menuId, factor * item.qty);

        // Track plates sold on the shift snapshot (openingPlates falls back to
        // pre-sale stock when the item has no snapshot — e.g. added mid-shift).
        if (currentShift) {
          // Freeze the engine alongside the figures so reports can tell a
          // shared pool from a split without re-deriving it later.
          const supply = await tx.stockSupplyMenu.findFirst({
            where: { menuId: item.menuId },
            select: { stockSupply: { select: { sellingMode: true } } },
          });
          const plates = round2(factor * item.qty);
          await tx.shiftSnapshot.upsert({
            where: { shiftId_menuId: { shiftId: currentShift.id, menuId: item.menuId } },
            create: {
              shiftId: currentShift.id,
              menuId: item.menuId,
              openingPlates: sellableBefore,
              platesSold: plates,
              sellingMode: supply?.stockSupply.sellingMode ?? "ALLOCATED",
            },
            update: { platesSold: { increment: plates } },
          });
        }
        // Align Menu.stock with pool truth after order creation
        await recomputeMenuStockWithSiblings(tx, item.menuId);
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
    // A stock rejection is the waiter's problem to fix, not a server fault:
    // report it as 409 with per-line numbers so the cart can be adjusted in
    // place instead of the page reloading.
    if (e instanceof InsufficientPoolError) {
      return res.status(409).json({
        error: e.message,
        code: "INSUFFICIENT_STOCK",
        shortfalls: e.shortfalls,
      });
    }
    console.error("Error creating order:", e);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// Update payment method and mark as paid
router.patch("/:id/payment", async (req, res) => {
  const { id } = req.params;
  const { paymentMethod, paymentType, batchId, mpesaAmount, cashAmount } = req.body;

  if (!paymentMethod || !["cash", "mpesa", "mpesa-cash-partial"].includes(paymentMethod)) {
    return res.status(400).json({ error: "paymentMethod must be 'cash', 'mpesa' or 'mpesa-cash-partial'" });
  }

  if (paymentType && !["SINGLE", "BATCH"].includes(paymentType)) {
    return res.status(400).json({ error: "paymentType must be 'SINGLE' or 'BATCH'" });
  }

  // A partial payment must carry the cashier-keyed portions; they are
  // checked against the order total (in cents) after the order is fetched.
  const isPartial = paymentMethod === "mpesa-cash-partial";
  if (isPartial) {
    if (typeof mpesaAmount !== "number" || typeof cashAmount !== "number") {
      return res.status(400).json({ error: "mpesaAmount and cashAmount are required for mpesa-cash-partial payments" });
    }
    if (!Number.isFinite(mpesaAmount) || !Number.isFinite(cashAmount) || mpesaAmount < 0 || cashAmount < 0) {
      return res.status(400).json({ error: "mpesaAmount and cashAmount must be non-negative numbers" });
    }
  }

  try {
    const order = await prisma.order.findUnique({ where: { id } });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.isPaid) {
      return res.status(400).json({ error: "Order is already paid" });
    }

    if (isPartial) {
      const keyedCents = Math.round((mpesaAmount + cashAmount) * 100);
      const totalCents = Math.round(Number(order.totalPrice) * 100);
      if (keyedCents !== totalCents) {
        return res.status(400).json({ error: "mpesaAmount plus cashAmount must equal the order total" });
      }
    }

    const updated = await prisma.order.update({
      where: { id },
      data: {
        paymentMethod,
        isPaid: true,
        paidAt: new Date(),
        ...(paymentType ? { paymentType } : {}),
        ...(batchId ? { batchId } : {}),
        // Partial payments persist the keyed portions; pure methods clear any
        // stale split left by a previous partial (mark-unpaid → re-pay cycle).
        ...(isPartial ? { mpesaAmount, cashAmount } : { mpesaAmount: null, cashAmount: null }),
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

    // Check if order belongs to the shift currently taking orders — same
    // resolution as order creation (drift-window aware), so an order placed
    // on a drifting shift can still be voided while it serves.
    const currentShift = await resolveCurrentShift();

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
      for (const item of order.OrderItem) {
        const menu = await tx.menu.findUnique({ where: { id: item.menuId } });
        if (!menu) {
          console.warn(`Menu item ${item.menuId} not found during void; stock restoration skipped for this item`);
        }

        // Restore from the allocation ledger rather than nudging Menu.stock:
        // split plates go back to the exact splits they came from, and a shared
        // pool recovers by the allocation row simply being removed. `Menu.stock`
        // is then re-derived, so it can never drift from the pool.
        // Read the ledger first: it is the only record of how many *plates* this
        // line cost, which is not `item.qty` for a weighted or portioned sale.
        const consumed = await tx.orderItemAllocation.aggregate({
          where: { orderItemId: item.id },
          _sum: { plates: true },
        });
        const platesConsumed = Number(consumed._sum?.plates ?? 0);
        await restoreForOrderItem(tx, item.id);
        await recomputeMenuStockWithSiblings(tx, item.menuId);

        // Update shift snapshot if exists
        if (order.shiftId) {
          const snapshot = await tx.shiftSnapshot.findUnique({
            where: { shiftId_menuId: { shiftId: order.shiftId, menuId: item.menuId } },
          });
          if (snapshot) {
            await tx.shiftSnapshot.update({
              where: { id: snapshot.id },
              data: { platesSold: Math.max(0, Number(snapshot.platesSold) - platesConsumed) },
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
