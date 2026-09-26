import { describe, it, expect, beforeEach } from "vitest";
import { createTestShift, createTestMenu, createOrderWithItems, createTestUser } from "./utils.js";
import { prisma } from "./setup.js";
import { autoCloseExpiredShifts } from "../scheduler.js";

const API = "http://localhost:3001/api";

describe("Customer assignment rules", () => {
  let shiftId: string;

  beforeEach(async () => {
    shiftId = (await createTestShift()).id;
  });

  it("assign-customer requires unpaidAcknowledged === true", async () => {
    const menuId = (await createTestMenu({ stock: 10 })).id;
    const order = await createOrderWithItems(shiftId, [{ menuId, qty: 1 }]);
    const res = await fetch(`${API}/orders/${order.id}/assign-customer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: "00000000-0000-0000-0000-000000000001", assignedById: "00000000-0000-0000-0000-000000000002" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Only orders marked as unpaid");
  });

  it("unpaid-ack with customerId marks unpaid AND assigns atomically", async () => {
    const menuId = (await createTestMenu({ stock: 10 })).id;
    const order = await createOrderWithItems(shiftId, [{ menuId, qty: 1 }]);
    const customer = await prisma.customer.create({ data: { name: "Test", phone: "0722000001" } });
    const res = await fetch(`${API}/orders/${order.id}/unpaid-ack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acknowledgedById: "00000000-0000-0000-0000-000000000003", customerId: customer.id }),
    });
    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.unpaidAcknowledged).toBe(true);
    expect(updated.customerId).toBe(customer.id);
    expect(updated.customerAssignedById).toBe("00000000-0000-0000-0000-000000000003");
  });

  it("unpaid-ack-undo also clears the customer link (I8)", async () => {
    const menuId = (await createTestMenu({ stock: 10 })).id;
    const order = await createOrderWithItems(shiftId, [{ menuId, qty: 1 }]);
    const customer = await prisma.customer.create({ data: { name: "Undo", phone: "0722000002" } });
    await fetch(`${API}/orders/${order.id}/unpaid-ack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acknowledgedById: "00000000-0000-0000-0000-000000000004", customerId: customer.id }),
    });
    const undoRes = await fetch(`${API}/orders/${order.id}/unpaid-ack-undo`, { method: "POST" });
    expect(undoRes.status).toBe(200);
    const undone = await undoRes.json();
    expect(undone.unpaidAcknowledged).toBe(false);
    expect(undone.customerId).toBeNull();
  });

  it("assign-customer to a paid order is blocked", async () => {
    const user = await createTestUser();
    const menuId = (await createTestMenu({ stock: 5 })).id;
    const created = await createOrderWithItems(shiftId, [{ menuId, qty: 1 }]);
    const order = await prisma.order.update({
      where: { id: created.id },
      data: { isPaid: true, paidAt: new Date() },
    });
    const customer = await prisma.customer.create({ data: { name: "Paid", phone: "0722000003" } });
    const res = await fetch(`${API}/orders/${order.id}/assign-customer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: customer.id, assignedById: user.id }),
    });
    expect(res.status).toBe(400);
  });

  it("assign-customer preserves the original mark timestamp", async () => {
    const menuId = (await createTestMenu({ stock: 5 })).id;
    const order = await createOrderWithItems(shiftId, [{ menuId, qty: 1 }]);
    const ack = await fetch(`${API}/orders/${order.id}/unpaid-ack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acknowledgedById: "00000000-0000-0000-0000-000000000008" }),
    });
    const marked = await ack.json();
    const customer = await prisma.customer.create({ data: { name: "Late", phone: "0722000009" } });

    const res = await fetch(`${API}/orders/${order.id}/assign-customer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: customer.id, assignedById: "00000000-0000-0000-0000-000000000009" }),
    });
    expect(res.status).toBe(200);
    const assigned = await res.json();
    expect(assigned.customerId).toBe(customer.id);
    // Attaching a customer must not restart the chase clock.
    expect(assigned.unpaidAcknowledgedAt).toBe(marked.unpaidAcknowledgedAt);
  });

  it("unpaid-count counts acknowledged unpaid orders, assigned or not", async () => {
    const menuId = (await createTestMenu({ stock: 20 })).id;
    const markedNoCustomer = await createOrderWithItems(shiftId, [{ menuId, qty: 1 }]);
    const markedWithCustomer = await createOrderWithItems(shiftId, [{ menuId, qty: 1 }]);
    const customer = await prisma.customer.create({ data: { name: "Counted", phone: "0722000010" } });

    for (const order of [markedNoCustomer, markedWithCustomer]) {
      await fetch(`${API}/orders/${order.id}/unpaid-ack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acknowledgedById: "00000000-0000-0000-0000-00000000000a" }),
      });
    }
    // Assigning a customer must not remove the order from the backlog count.
    await fetch(`${API}/orders/${markedWithCustomer.id}/assign-customer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: customer.id, assignedById: "00000000-0000-0000-0000-00000000000b" }),
    });

    // Still pending collection: must NOT count.
    await createOrderWithItems(shiftId, [{ menuId, qty: 1 }]);

    const res = await fetch(`${API}/orders/unpaid-count`);
    expect(res.status).toBe(200);
    const { count } = await res.json();
    const expected = await prisma.order.count({
      where: { unpaidAcknowledged: true, isPaid: false, isVoid: false },
    });
    expect(count).toBe(expected);
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it("needs-customer endpoint is gone and no longer crashes the server", async () => {
    const res = await fetch(`${API}/customers/needs-customer`);
    // Falls through to GET /customers/:id, which must reject a non-UUID rather
    // than letting Prisma throw and take the process down.
    expect(res.status).toBe(400);
    // The server is still alive and serving.
    const alive = await fetch(`${API}/orders/unpaid-count`);
    expect(alive.status).toBe(200);
  });

  /**
   * A shift that is already due for auto-close, paired with a ShiftConfig for
   * its exact type. Built directly (not via createTestShift) so its unique type
   * cannot collide with the shared beforeEach shift on the
   * (type, operationDay) unique constraint.
   */
  async function createExpiredShift(manual: boolean) {
    const type = `AUTOCLOSE-${manual}-${Date.now()}-${Math.random()}`;
    const operationDay = new Date();
    const shift = await prisma.shift.create({
      data: {
        type,
        operationDay,
        autoOpenTime: new Date(operationDay.getTime() - 20 * 60 * 60 * 1000),
        autoCloseTime: new Date(Date.now() - 60_000),
        isOpen: true,
        autoClosed: false,
      },
    });
    await prisma.shiftConfig.deleteMany({ where: { type } });
    await prisma.shiftConfig.create({
      data: { type, autoOpenTime: "06:00", autoCloseTime: "22:00", manual },
    });
    return shift;
  }

  it("auto-close marks pending orders unpaid and records the system ack", async () => {
    const shift = await createExpiredShift(false);
    const menuId = (await createTestMenu({ stock: 20 })).id;
    const pending = await createOrderWithItems(shift.id, [{ menuId, qty: 1 }]);
    const paid = await createOrderWithItems(shift.id, [{ menuId, qty: 1 }]);
    await prisma.order.update({ where: { id: paid.id }, data: { isPaid: true } });
    const voided = await createOrderWithItems(shift.id, [{ menuId, qty: 1 }]);
    await prisma.order.update({ where: { id: voided.id }, data: { isVoid: true } });

    const closed = await autoCloseExpiredShifts();
    expect(closed.some((s) => s?.id === shift.id)).toBe(true);

    const after = await prisma.order.findUnique({ where: { id: pending.id } });
    expect(after?.unpaidAcknowledged).toBe(true);
    expect(after?.unpaidAcknowledgedAt).not.toBeNull();
    // Nobody signed off, so the system is recorded as the acknowledger.
    expect(after?.unpaidAcknowledgedById).toBeNull();

    const paidAfter = await prisma.order.findUnique({ where: { id: paid.id } });
    expect(paidAfter?.unpaidAcknowledged).toBe(false);
    const voidedAfter = await prisma.order.findUnique({ where: { id: voided.id } });
    expect(voidedAfter?.unpaidAcknowledged).toBe(false);
  });

  it("auto-close leaves manual-close shifts for a manager to review", async () => {
    const shift = await createExpiredShift(true);
    const menuId = (await createTestMenu({ stock: 20 })).id;
    const pending = await createOrderWithItems(shift.id, [{ menuId, qty: 1 }]);

    await autoCloseExpiredShifts();

    const after = await prisma.order.findUnique({ where: { id: pending.id } });
    expect(after?.unpaidAcknowledged).toBe(false);
    const shiftAfter = await prisma.shift.findUnique({ where: { id: shift.id } });
    expect(shiftAfter?.isOpen).toBe(true);
  });

  it("auto-close is idempotent and never restamps the ack time", async () => {
    const shift = await createExpiredShift(false);
    const menuId = (await createTestMenu({ stock: 20 })).id;
    const pending = await createOrderWithItems(shift.id, [{ menuId, qty: 1 }]);

    await autoCloseExpiredShifts();
    const first = await prisma.order.findUnique({ where: { id: pending.id } });

    // Re-open the shift so the second pass has something to look at, then close again.
    await prisma.shift.update({
      where: { id: shift.id },
      data: { autoClosed: false, isOpen: true, autoCloseTime: new Date(Date.now() - 1_000) },
    });
    await autoCloseExpiredShifts();
    const second = await prisma.order.findUnique({ where: { id: pending.id } });

    expect(second?.unpaidAcknowledged).toBe(true);
    expect(second?.unpaidAcknowledgedAt).toEqual(first?.unpaidAcknowledgedAt);
  });

  it("duplicate stripped phone returns 409", async () => {
    // Seeded through the API so the stored phone is normalized; a direct
    // prisma.create would keep the spaces and never collide.
    const seeded = await fetch(`${API}/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Dup", phone: "0722 000 000" }),
    });
    expect(seeded.status).toBe(201);
    const { phone: stored } = await seeded.json();
    expect(stored).toBe("0722000000");

    const res = await fetch(`${API}/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Dup2", phone: "0722000000" }),
    });
    expect(res.status).toBe(409);
  });
});
