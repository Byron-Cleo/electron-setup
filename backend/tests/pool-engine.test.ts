import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "./setup.js";
import {
  batchPools,
  consumeForOrderItem,
  restoreForOrderItem,
  sellableForMenu,
  recomputeMenuStock,
  assertLinesServable,
  InsufficientPoolError,
  consumptionFactorsForSupply,
  factorForServing,
  round2,
} from "../pools.js";
import { createTestShift, createTestUser } from "./utils.js";

/**
 * The pool engine is the riskiest part of the feature: it decides whether a
 * plate is sellable. These tests pin the arithmetic and the two engines'
 * separation rather than trusting the happy path.
 */
describe("Production pool engine", () => {
  let supplyId: string;
  let menuId: string;

  async function linkSupplyToMenu(menus: string[], factor = 1) {
    await prisma.stockSupplyMenu.createMany({
      data: menus.map((id) => ({ stockSupplyId: supplyId, menuId: id, platesPerServing: factor })),
    });
  }

  async function cook(
    opts: {
      produced: number;
      mode?: "ALLOCATED" | "SHARED";
      splits?: { menuId: string; allocated: number; remaining: number }[];
      createdAt?: Date;
    },
  ) {
    const user = await createTestUser();
    return prisma.cookingRecord.create({
      data: {
        stockSupplyId: supplyId,
        cookedById: user.id,
        quantityCooked: opts.produced,
        platesExpected: opts.produced,
        sellingMode: opts.mode ?? "ALLOCATED",
        createdAt: opts.createdAt,
        ...(opts.splits?.length
          ? {
              cookingRecordMenus: {
                create: opts.splits.map((s) => ({
                  menuId: s.menuId,
                  platesAllocated: s.allocated,
                  platesRemaining: s.remaining,
                })),
              },
            }
          : {}),
      },
    });
  }

/** Minimal order + line, so allocations have an FK to hang off. */
async function lineFor(menuId: string) {
    const shift = await createTestShift();
    const user = await createTestUser();
    // Scalars only: a nested relation would force the checked input shape and
    // Prisma's XOR rejects mixing it with the `menuId` scalar below.
    const order = await prisma.order.create({
      data: {
        userId: user.id,
        shiftId: shift.id,
        mealType: "LUNCH",
        shippingAddress: {},
        paymentMethod: "cash",
        itemsPrice: 0,
        shippingPrice: 0,
        taxPrice: 0,
        totalPrice: 0,
      },
      select: { id: true },
    });
    return prisma.orderItem.create({
      data: {
        orderId: order.id,
        menuId,
        qty: 1,
        price: 10,
        name: "Test",
        slug: "test",
        image: "",
      },
      select: { id: true },
    });
  }

  beforeEach(async () => {
    const supply = await prisma.stockSupply.create({
      data: { name: `supply-${Date.now()}`, slug: `supply-${Date.now()}`, unit: "PCS" },
    });
    supplyId = supply.id;
    const menu = await prisma.menu.create({
      data: { name: "Fried Fish", slug: `ff-${Date.now()}`, images: [], category: "main", stock: 0 },
    });
    menuId = menu.id;
    await linkSupplyToMenu([menuId]);
  });

  describe("ALLOCATED engine", () => {
    it("sells only the allocated split, never the unassigned remainder", async () => {
      const batch = await cook({
        produced: 20,
        splits: [{ menuId, allocated: 8, remaining: 8 }],
      });

      // 20 produced but only 8 handed to this dish: the other 12 are not sellable.
      expect(await sellableForMenu(prisma, menuId)).toBe(8);

      const pools = await batchPools(prisma, { id: batch.id });
      const pool = pools.get(batch.id)!;
      expect(pool.poolRemaining).toBe(20);
      expect(pool.allocatedTotal).toBe(8);
      expect(pool.unassigned).toBe(12);
    });

    it("drains the split and records the allocation", async () => {
      const batch = await cook({ produced: 20, splits: [{ menuId, allocated: 8, remaining: 8 }] });
      const line = await lineFor(menuId);

      await consumeForOrderItem(prisma, line.id, menuId, 3);

      const split = await prisma.cookingRecordMenu.findFirst({ where: { menuId } });
      expect(Number(split!.platesRemaining)).toBe(5);

      const alloc = await prisma.orderItemAllocation.findFirst({ where: { orderItemId: line.id } });
      expect(Number(alloc!.plates)).toBe(3);
      expect(alloc!.cookingRecordMenuId).toBe(split!.id);
    });

    it("restores plates to the split on void", async () => {
      await cook({ produced: 20, splits: [{ menuId, allocated: 8, remaining: 8 }] });
      const line = await lineFor(menuId);
      await consumeForOrderItem(prisma, line.id, menuId, 5);
      expect(await sellableForMenu(prisma, menuId)).toBe(3);

      await restoreForOrderItem(prisma, line.id);
      expect(await sellableForMenu(prisma, menuId)).toBe(8);
    });
  });

  describe("SHARED engine", () => {
    it("makes the whole pool sellable with no allocation step", async () => {
      await cook({ produced: 20, mode: "SHARED" });

      // No splits exist at all, yet the entire batch is sellable.
      expect(await prisma.cookingRecordMenu.count({ where: { menuId } })).toBe(0);
      expect(await sellableForMenu(prisma, menuId)).toBe(20);
    });

    it("deducts by deleting nothing but recording the allocation (derived pool)", async () => {
      const batch = await cook({ produced: 20, mode: "SHARED" });
      const line = await lineFor(menuId);

      await consumeForOrderItem(prisma, line.id, menuId, 6);

      const alloc = await prisma.orderItemAllocation.findFirst({ where: { orderItemId: line.id } });
      expect(Number(alloc!.plates)).toBe(6);
      // A shared pool has no per-dish split to point at.
      expect(alloc!.cookingRecordMenuId).toBeNull();

      const pools = await batchPools(prisma, { id: batch.id });
      expect(pools.get(batch.id)!.poolRemaining).toBe(14);
      expect(await sellableForMenu(prisma, menuId)).toBe(14);
    });

    it("returns plates to the shared pool when the allocation row is removed", async () => {
      await cook({ produced: 20, mode: "SHARED" });
      const line = await lineFor(menuId);
      await consumeForOrderItem(prisma, line.id, menuId, 6);
      expect(await sellableForMenu(prisma, menuId)).toBe(14);

      await restoreForOrderItem(prisma, line.id);
      // No split to increment — the derived pool recovers by itself.
      expect(await sellableForMenu(prisma, menuId)).toBe(20);
    });

    it("counts both engines for a dish fed by each, but only their sellable parts", async () => {
      // An ALLOCATED batch produced 10 with only 4 handed to this dish, so its
      // 6 unassigned plates must never become sellable.
      await cook({ produced: 10, mode: "ALLOCATED", splits: [{ menuId, allocated: 4, remaining: 4 }] });
      await cook({ produced: 6, mode: "SHARED" });

      // 4 from the split + 6 from the shared pool. Were unassigned leaking,
      // this would read 16.
      expect(await sellableForMenu(prisma, menuId)).toBe(10);
    });

    it("drains FIFO across several batches, oldest first", async () => {
      const t0 = new Date("2026-01-01T10:00:00Z");
      await cook({ produced: 5, mode: "SHARED", createdAt: t0 });
      await cook({ produced: 5, mode: "SHARED", createdAt: new Date(t0.getTime() + 3600_000) });

      const line = await lineFor(menuId);
      await consumeForOrderItem(prisma, line.id, menuId, 7);

      const allocs = await prisma.orderItemAllocation.findMany({ where: { orderItemId: line.id } });
      // 5 from the older batch, then 2 from the newer one.
      expect(allocs.map((a) => Number(a.plates)).sort()).toEqual([2, 5]);
      expect(await sellableForMenu(prisma, menuId)).toBe(3);
    });
  });

  describe("weighted consumption", () => {
    it("charges a 0.5 rate per serving, so 4 halves consume 2 plates", async () => {
      await prisma.stockSupplyMenu.updateMany({
        where: { stockSupplyId: supplyId, menuId },
        data: { platesPerServing: 0.5 },
      });
      await cook({ produced: 20, splits: [{ menuId, allocated: 20, remaining: 20 }] });

      const line = await lineFor(menuId);
      await consumeForOrderItem(prisma, line.id, menuId, 2); // 4 half-servings

      expect(await sellableForMenu(prisma, menuId)).toBe(18);
    });

    it("keeps a fractional pool exact instead of truncating it", async () => {
      await prisma.stockSupplyMenu.updateMany({
        where: { stockSupplyId: supplyId, menuId },
        data: { platesPerServing: 0.5 },
      });
      await cook({ produced: 20, splits: [{ menuId, allocated: 20, remaining: 20 }] });
      const line = await lineFor(menuId);

      await consumeForOrderItem(prisma, line.id, menuId, 0.5); // one half-serving

      // 19.5 must survive as 19.5, not snap back to 19 or 20.
      expect(await sellableForMenu(prisma, menuId)).toBe(19.5);
      expect(await recomputeMenuStock(prisma, menuId)).toBe(19.5);
      expect(Number((await prisma.menu.findUnique({ where: { id: menuId } }))!.stock)).toBe(19.5);
    });

    it("will not sell a fraction of a serving", async () => {
      await prisma.stockSupplyMenu.updateMany({
        where: { stockSupplyId: supplyId, menuId },
        data: { platesPerServing: 0.5 },
      });
      // 1 plate left is 2 half-servings; asking for 3 needs 1.5 plates.
      await cook({ produced: 20, splits: [{ menuId, allocated: 1, remaining: 1 }] });

      await expect(
        assertLinesServable(prisma, [{ menuId, name: "Fried Fish", qty: 3 }]),
      ).rejects.toBeInstanceOf(InsufficientPoolError);
    });

    it("lets a portion rate override the dish rate", async () => {
      const portion = await prisma.menuAccompaniment.create({
        data: {
          name: "2 Pieces",
          image: "",
          category: "PORTION",
          platesPerServing: 2,
          menuId,
        },
      });
      await prisma.menu.update({ where: { id: menuId }, data: { hasPortion: true } });

      expect(await factorForServing(prisma, menuId, null)).toBe(1);
      expect(await factorForServing(prisma, menuId, portion.id)).toBe(2);
    });

    it("treats a shared supply as illegal when any dish is not a flat 1-for-1", async () => {
      await prisma.stockSupplyMenu.updateMany({
        where: { stockSupplyId: supplyId, menuId },
        data: { platesPerServing: 0.5 },
      });
      const factors = await consumptionFactorsForSupply(prisma, supplyId);
      expect(factors[0].factors).toContain(0.5);
      expect(factors[0].factors.some((f) => f !== 1)).toBe(true);
    });

    it("allows a shared supply when every dish and portion is 1-for-1", async () => {
      const factors = await consumptionFactorsForSupply(prisma, supplyId);
      expect(factors.every((f) => f.factors.every((n) => n === 1))).toBe(true);
    });
  });

  describe("order pre-check", () => {
    it("reports every shortfall at once with real numbers", async () => {
      const other = await prisma.menu.create({
        data: { name: "Boiled Meat", slug: `bm-${Date.now()}`, images: [], category: "main", stock: 0 },
      });
      await linkSupplyToMenu([other.id]);
      await cook({ produced: 3, mode: "SHARED" });

      let caught: InsufficientPoolError | null = null;
      try {
        await assertLinesServable(prisma, [
          { menuId, name: "Fried Fish", qty: 10 },
          { menuId: other.id, name: "Boiled Meat", qty: 5 },
        ]);
      } catch (e) {
        caught = e as InsufficientPoolError;
      }

      expect(caught).toBeInstanceOf(InsufficientPoolError);
      expect(caught!.shortfalls).toHaveLength(2);
      for (const s of caught!.shortfalls) {
        expect(s.available).toBe(3);
        expect(s.requested).toBeGreaterThan(3);
      }
    });

    it("sums two portions of one dish against a single pool", async () => {
      await cook({ produced: 4, mode: "SHARED" });
      // 3 x one-piece (1 each) + 1 x two-piece (2 each) = 5 plates of a 4 plate pool.
      const portion = await prisma.menuAccompaniment.create({
        data: { name: "2 Pieces", image: "", category: "PORTION", platesPerServing: 2, menuId },
      });

      await expect(
        assertLinesServable(prisma, [
          { menuId, name: "Fried Fish", qty: 3 },
          { menuId, name: "Fried Fish", qty: 1, portionId: portion.id },
        ]),
      ).rejects.toBeInstanceOf(InsufficientPoolError);
    });

    it("passes when demand exactly equals supply", async () => {
      await cook({ produced: 4, mode: "SHARED" });
      await expect(
        assertLinesServable(prisma, [{ menuId, name: "Fried Fish", qty: 4 }]),
      ).resolves.toBeUndefined();
    });
  });

  it("rounds to 2dp so repeated half steps cannot drift", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(19.5 - 0.5)).toBe(19);
    expect(round2(9.999999)).toBe(10);
  });
});