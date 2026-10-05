import { type Prisma, SellingMode } from "./db/generated/prisma/client.js";

/**
 * Production-pool engine.
 *
 * Every cooked batch is a pool of produced plates. How that pool becomes
 * sellable depends on the batch's `sellingMode`, frozen at cook time:
 *
 *  - ALLOCATED — a manager split the pool per dish. Only the allocated
 *    amounts are sellable; the unassigned remainder is never sellable and
 *    carries over untouched.
 *  - SHARED — the whole pool is sellable by every dish derived from the
 *    supply, with no allocation step at all.
 *
 * The pool itself is *derived*, never stored:
 *
 *   poolRemaining = produced - sold - wasted
 *
 * where `sold` is the sum of `OrderItemAllocation.plates` for the batch. That
 * makes the ledger self-healing: every plate is accounted for by exactly one
 * order line or one disposal record, so the two can never disagree.
 *
 * Consumption is *weighted*. One serving of a dish costs
 * `platesPerServing` plates of the pool, resolved per (supply, dish) pair so a
 * dish fed by two supplies would still deduct at the correct rate for whichever
 * batch served it. Boiled Meat Half is 0.5, so allocating 4 halves consumes
 * 2.0 plates, not 4.
 */

/** A dish is sellable up to this factor only if the supply is uniform. */
export const DEFAULT_PLATES_PER_SERVING = 1;

export type PoolSource =
  | {
      kind: "split";
      batchId: string;
      createdAt: Date;
      /** Nothing to consume from — guarded by remaining below. */
      splitId: string;
      remaining: number;
      factor: number;
    }
  | {
      kind: "shared";
      batchId: string;
      createdAt: Date;
      /** Null: a shared pool is not partitioned per dish. */
      splitId: null;
      remaining: number;
      factor: number;
    };

export type BatchPool = {
  id: string;
  stockSupplyId: string;
  createdAt: Date;
  sellingMode: SellingMode;
  produced: number;
  sold: number;
  wasted: number;
  /** produced - sold - wasted. The physical plates still in the tray. */
  poolRemaining: number;
  /** Sum of platesAllocated across splits (ALLOCATED only). */
  allocatedTotal: number;
  /** Sum of platesRemaining across splits (ALLOCATED only). */
  splitRemainingTotal: number;
  /** poolRemaining - splitRemainingTotal. Never sellable; carries over. */
  unassigned: number;
};

export type MenuShortfall = {
  menuId: string;
  name: string;
  /** What the waiter asked for, in plates. */
  requested: number;
  /** What is actually sellable, in plates. */
  available: number;
  platesPerServing: number;
};

/**
 * Thrown when an order asks for more than the pool can serve. Carries every
 * offending line so the waiter learns about all of them at once instead of
 * discovering them one rejected attempt at a time.
 */
export class InsufficientPoolError extends Error {
  readonly shortfalls: MenuShortfall[];
  constructor(shortfalls: MenuShortfall[]) {
    const first = shortfalls[0];
    const extra = shortfalls.length > 1 ? ` (+${shortfalls.length - 1} more)` : "";
    super(
      `Not enough stock for ${first.name}: only ${formatPlates(first.available)} left, you asked for ${formatPlates(first.requested)}${extra}`,
    );
    this.name = "InsufficientPoolError";
    this.shortfalls = shortfalls;
  }
}

/** Render a plate count without a misleading trailing ".0" on whole numbers. */
export function formatPlates(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, "");
}

type BatchRow = {
  id: string;
  stockSupplyId: string;
  createdAt: Date;
  sellingMode: SellingMode;
  platesExpected: unknown;
  platesActual: unknown;
  wastedPlates: unknown;
  cookingRecordMenus: { platesAllocated: unknown; platesRemaining: unknown }[];
};

/**
 * Load and derive pools for the given batches. One grouped aggregate for all
 * of their sales rather than a per-batch query.
 */
export async function batchPools(
  tx: Prisma.TransactionClient,
  where: Prisma.CookingRecordWhereInput,
): Promise<Map<string, BatchPool>> {
  const batches = await tx.cookingRecord.findMany({
    where,
    select: {
      id: true,
      stockSupplyId: true,
      createdAt: true,
      sellingMode: true,
      platesExpected: true,
      platesActual: true,
      wastedPlates: true,
      cookingRecordMenus: { select: { platesAllocated: true, platesRemaining: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const ids = batches.map((b) => b.id);
  const soldByBatch = new Map<string, number>();
  if (ids.length > 0) {
    const sold = await tx.orderItemAllocation.groupBy({
      by: ["cookingRecordId"],
      where: { cookingRecordId: { in: ids } },
      _sum: { plates: true },
    });
    for (const row of sold) {
      soldByBatch.set(row.cookingRecordId, Number(row._sum.plates ?? 0));
    }
  }

  const out = new Map<string, BatchPool>();
  for (const b of batches as BatchRow[]) {
    const produced = Number(b.platesActual ?? b.platesExpected ?? 0);
    const sold = soldByBatch.get(b.id) ?? 0;
    const wasted = Number(b.wastedPlates ?? 0);
    const poolRemaining = round2(produced - sold - wasted);
    const allocatedTotal = round2(
      b.cookingRecordMenus.reduce((s, m) => s + Number(m.platesAllocated), 0),
    );
    const splitRemainingTotal = round2(
      b.cookingRecordMenus.reduce((s, m) => s + Number(m.platesRemaining), 0),
    );
    out.set(b.id, {
      id: b.id,
      stockSupplyId: b.stockSupplyId,
      createdAt: b.createdAt,
      sellingMode: b.sellingMode,
      produced: round2(produced),
      sold: round2(sold),
      wasted: round2(wasted),
      poolRemaining,
      allocatedTotal,
      splitRemainingTotal,
      // A SHARED batch has no splits, so this collapses to the whole pool.
      unassigned: round2(poolRemaining - splitRemainingTotal),
    });
  }
  return out;
}

/** Keep plate arithmetic exact to 2dp so repeated 0.5 steps cannot drift. */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Consumption rate for one (supply, dish) pair. Defaults to 1 for a dish with
 * no supply link, which keeps admin-created dishes fully orderable.
 */
export async function factorForSupplyMenu(
  tx: Prisma.TransactionClient,
  stockSupplyId: string,
  menuId: string,
): Promise<number> {
  const link = await tx.stockSupplyMenu.findUnique({
    where: { stockSupplyId_menuId: { stockSupplyId, menuId } },
    select: { platesPerServing: true },
  });
  const n = Number(link?.platesPerServing ?? DEFAULT_PLATES_PER_SERVING);
  return n > 0 ? n : DEFAULT_PLATES_PER_SERVING;
}

/**
 * Every consumption rate that applies to a dish: the rate from each supply it
 * can be made from, plus the rate of each of its portions when it has any.
 *
 * A supply may only run SHARED when this returns nothing but 1 — otherwise
 * servings compete for one pool at different rates, which is exactly the
 * situation a person must decide, so it must stay ALLOCATED.
 */
export async function consumptionFactorsForMenu(
  tx: Prisma.TransactionClient,
  menuId: string,
): Promise<number[]> {
  const [links, portions] = await Promise.all([
    tx.stockSupplyMenu.findMany({ where: { menuId }, select: { platesPerServing: true } }),
    tx.menuAccompaniment.findMany({
      where: { category: "PORTION", menuId },
      select: { platesPerServing: true },
    }),
  ]);
  const factors = [
    ...links.map((l) => Number(l.platesPerServing)),
    ...portions.map((p) => Number(p.platesPerServing)),
  ].filter((n) => n > 0);
  return factors.length > 0 ? factors : [DEFAULT_PLATES_PER_SERVING];
}

/**
 * Every consumption rate in use across a supply's dishes, including its
 * dishes' portions. Used to decide whether SHARED is legal for this supply.
 */
export async function consumptionFactorsForSupply(
  tx: Prisma.TransactionClient,
  stockSupplyId: string,
): Promise<{ menuId: string; menuName: string; factors: number[] }[]> {
  const links = await tx.stockSupplyMenu.findMany({
    where: { stockSupplyId },
    select: { menuId: true, platesPerServing: true, menu: { select: { name: true, hasPortion: true, portionId: true } } },
    orderBy: { menuId: "asc" },
  });

  const out: { menuId: string; menuName: string; factors: number[] }[] = [];
  for (const link of links) {
    const factors = [Number(link.platesPerServing)];
    if (link.menu.hasPortion) {
      const portions = await tx.menuAccompaniment.findMany({
        where: { category: "PORTION", menuId: link.menuId },
        select: { platesPerServing: true },
      });
      factors.push(...portions.map((p) => Number(p.platesPerServing)));
    }
    out.push({ menuId: link.menuId, menuName: link.menu.name, factors });
  }
  return out;
}

/**
 * Plates one serving of this dish consumes. A portion overrides the dish's own
 * rate, because "2 pieces" costs two eggs while the dish itself costs one.
 */
export async function factorForServing(
  tx: Prisma.TransactionClient,
  menuId: string,
  portionId?: string | null,
): Promise<number> {
  if (portionId) {
    const portion = await tx.menuAccompaniment.findUnique({
      where: { id: portionId },
      select: { platesPerServing: true, category: true },
    });
    if (portion?.category === "PORTION") {
      const n = Number(portion.platesPerServing);
      if (n > 0) return n;
    }
  }
  const links = await tx.stockSupplyMenu.findMany({
    where: { menuId },
    select: { platesPerServing: true },
  });
  const rates = links.map((l) => Number(l.platesPerServing)).filter((n) => n > 0);
  if (rates.length === 0) return DEFAULT_PLATES_PER_SERVING;
  // Max keeps the waiter's displayed cap honest when a dish has several feeds.
  return Math.max(...rates);
}

/**
 * The plates of one dish that can currently be ordered.
 *
 * ALLOCATED batches contribute their split remainders (never their unassigned
 * remainder — that is not sellable). SHARED batches contribute their whole
 * remaining pool, because the pool is sellable by every dish on the supply.
 */
export async function sellableForMenu(
  tx: Prisma.TransactionClient,
  menuId: string,
): Promise<number> {
  const splitAgg = await tx.cookingRecordMenu.aggregate({
    where: { menuId },
    _sum: { platesRemaining: true },
  });
  let sellable = Number(splitAgg._sum?.platesRemaining ?? 0);

  const supplyIds = (
    await tx.stockSupplyMenu.findMany({ where: { menuId }, select: { stockSupplyId: true } })
  ).map((l) => l.stockSupplyId);

  if (supplyIds.length > 0) {
    const pools = await batchPools(tx, { sellingMode: SellingMode.SHARED, stockSupplyId: { in: supplyIds } });
    for (const pool of pools.values()) {
      sellable += pool.poolRemaining;
    }
  }
  return round2(sellable);
}

/**
 * Every plate source that can serve one dish, oldest batch first, so a single
 * FIFO order drains all of them. Mixing ALLOCATED splits and SHARED pools in
 * one ordered list is what keeps a dish fed by both engines from draining one
 * while the other goes stale.
 */
export async function sourcesForMenu(
  tx: Prisma.TransactionClient,
  menuId: string,
): Promise<PoolSource[]> {
  const supplyIds = (
    await tx.stockSupplyMenu.findMany({ where: { menuId }, select: { stockSupplyId: true } })
  ).map((l) => l.stockSupplyId);

  const sharedWhere: Prisma.CookingRecordWhereInput =
    supplyIds.length > 0
      ? { sellingMode: SellingMode.SHARED, stockSupplyId: { in: supplyIds } }
      : { sellingMode: SellingMode.SHARED, stockSupplyId: "__none__" };

  const [pools, splits] = await Promise.all([
    batchPools(tx, sharedWhere),
    tx.cookingRecordMenu.findMany({
      where: { menuId, platesRemaining: { gt: 0 } },
      select: {
        id: true,
        platesRemaining: true,
        cookingRecord: {
          select: { id: true, createdAt: true, stockSupplyId: true, sellingMode: true },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const sources: PoolSource[] = [];
  // Factor is a property of the (supply, dish) pair, so resolve it once per
  // supply rather than once per split.
  const factorCache = new Map<string, number>();

  for (const s of splits) {
    const supplyId = s.cookingRecord.stockSupplyId;
    if (!factorCache.has(supplyId)) {
      factorCache.set(supplyId, await factorForSupplyMenu(tx, supplyId, menuId));
    }
    sources.push({
      kind: "split",
      batchId: s.cookingRecord.id,
      createdAt: s.cookingRecord.createdAt,
      splitId: s.id,
      remaining: Number(s.platesRemaining),
      factor: factorCache.get(supplyId)!,
    });
  }

  for (const pool of pools.values()) {
    if (pool.poolRemaining <= 0) continue;
    if (!factorCache.has(pool.stockSupplyId)) {
      factorCache.set(pool.stockSupplyId, await factorForSupplyMenu(tx, pool.stockSupplyId, menuId));
    }
    sources.push({
      kind: "shared",
      batchId: pool.id,
      createdAt: pool.createdAt,
      splitId: null,
      remaining: pool.poolRemaining,
      factor: factorCache.get(pool.stockSupplyId)!,
    });
  }

  sources.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return sources;
}

/**
 * Check every line against the pool *before* anything is written, so the
 * waiter is told about all shortfalls at once and a rejection has no side
 * effects to undo.
 */
export async function assertLinesServable(
  tx: Prisma.TransactionClient,
  lines: { menuId: string; name: string; qty: number; portionId?: string | null }[],
): Promise<void> {
  // Two lines of one dish (different portions) share one pool, so they must be
  // checked against their combined demand, not one at a time.
  const demandByMenu = new Map<string, { name: string; plates: number; factor: number }>();
  for (const line of lines) {
    const factor = await factorForServing(tx, line.menuId, line.portionId);
    const entry = demandByMenu.get(line.menuId) ?? {
      name: line.name,
      plates: 0,
      factor,
    };
    entry.plates = round2(entry.plates + factor * line.qty);
    entry.factor = Math.max(entry.factor, factor);
    demandByMenu.set(line.menuId, entry);
  }

  const shortfalls: MenuShortfall[] = [];
  for (const [menuId, { name, plates, factor }] of demandByMenu) {
    const available = await sellableForMenu(tx, menuId);
    if (plates > available) {
      shortfalls.push({
        menuId,
        name,
        requested: plates,
        available: round2(available),
        platesPerServing: factor,
      });
    }
  }

  if (shortfalls.length > 0) throw new InsufficientPoolError(shortfalls);
}

/**
 * Consume `plates` worth of pool for one order line, FIFO across every source.
 * Records an `OrderItemAllocation` per chunk so void can restore exactly.
 *
 * For a split the deduction is stored on `platesRemaining`; for a shared pool
 * the allocation row *is* the deduction, because the pool is derived from the
 * sum of allocations.
 */
export async function consumeForOrderItem(
  tx: Prisma.TransactionClient,
  orderItemId: string,
  menuId: string,
  plates: number,
): Promise<void> {
  let toDeduct = round2(plates);
  if (toDeduct <= 0) return;

  for (const source of await sourcesForMenu(tx, menuId)) {
    if (toDeduct <= 0) break;
    // Only whole servings can be taken, so a 0.5 rate cannot be drained from a
    // pool of 9.5 by the last half-serving: 9.5 / 0.5 = 19 full servings.
    const servings = Math.floor(source.remaining / source.factor + 1e-9);
    const usable = round2(servings * source.factor);
    if (usable <= 0) continue;

    const take = round2(Math.min(usable, toDeduct));

    if (source.kind === "split") {
      await tx.cookingRecordMenu.update({
        where: { id: source.splitId },
        data: { platesRemaining: { decrement: take } },
      });
      await tx.orderItemAllocation.create({
        data: {
          orderItemId,
          cookingRecordId: source.batchId,
          cookingRecordMenuId: source.splitId,
          plates: take,
        },
      });
    } else {
      await tx.orderItemAllocation.create({
        data: {
          orderItemId,
          cookingRecordId: source.batchId,
          cookingRecordMenuId: null,
          plates: take,
        },
      });
    }
    toDeduct = round2(toDeduct - take);
  }
}

/**
 * Undo one order line's consumption: restore split remainders and drop the
 * allocation rows. A shared-pool row needs no restore — deleting the
 * allocation returns the plate to the derived pool automatically.
 */
export async function restoreForOrderItem(
  tx: Prisma.TransactionClient,
  orderItemId: string,
): Promise<void> {
  const allocations = await tx.orderItemAllocation.findMany({
    where: { orderItemId },
    orderBy: { createdAt: "desc" },
    select: { id: true, cookingRecordMenuId: true, plates: true },
  });

  for (const alloc of allocations) {
    if (alloc.cookingRecordMenuId) {
      await tx.cookingRecordMenu.update({
        where: { id: alloc.cookingRecordMenuId },
        data: { platesRemaining: { increment: Number(alloc.plates) } },
      });
    }
  }
  if (allocations.length > 0) {
    await tx.orderItemAllocation.deleteMany({ where: { orderItemId } });
  }
}

/**
 * Recompute a dish's sellable stock and mirror it onto `Menu.stock`.
 *
 * `Menu.stock` is a mirror for the waiter grid, the stock-status buckets and
 * the admin screens — it is not the ledger. This is the only writer.
 */
export async function recomputeMenuStock(
  tx: Prisma.TransactionClient,
  menuId: string,
): Promise<number> {
  const total = await sellableForMenu(tx, menuId);
  await tx.menu.update({ where: { id: menuId }, data: { stock: round2(total) } });
  return total;
}