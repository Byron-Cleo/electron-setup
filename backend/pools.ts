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
  // A disposed batch has been written off as waste: its plates are gone, so it
  // can no longer serve a dish and must not count toward sellable stock.
  const batches = await tx.cookingRecord.findMany({
    where: { ...where, disposed: false },
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

/** Narrow DB surface needed by allocation-derived helpers. */
type PoolDb = Pick<Prisma.TransactionClient, "orderItemAllocation">;

/**
 * Plates sold off one or more batches, grouped per dish. Works for BOTH
 * engines: every consumed plate writes an `OrderItemAllocation` linked to the
 * order line's dish, so this is the one true per-dish trace — where an
 * ALLOCATED batch can also be read from split remainders, a SHARED pool has no
 * splits and only this exists.
 */
export async function soldByMenuForBatches(
  db: PoolDb,
  batchIds: string[],
): Promise<Map<string, Map<string, { name: string; sold: number }>>> {
  const allocations = await db.orderItemAllocation.findMany({
    where: { cookingRecordId: { in: batchIds } },
    select: {
      cookingRecordId: true,
      plates: true,
      orderItem: { select: { menuId: true, Menu: { select: { name: true } } } },
    },
  });
  const byBatch = new Map<string, Map<string, { name: string; sold: number }>>();
  for (const a of allocations) {
    let byMenu = byBatch.get(a.cookingRecordId);
    if (!byMenu) {
      byMenu = new Map();
      byBatch.set(a.cookingRecordId, byMenu);
    }
    const plates = round2(Number(a.plates));
    const prev = byMenu.get(a.orderItem.menuId);
    byMenu.set(a.orderItem.menuId, {
      name: a.orderItem.Menu.name,
      sold: round2((prev?.sold ?? 0) + plates),
    });
  }
  return byBatch;
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
 * The live supply behind one dish, and the engine that actually produced it.
 *
 * The engine is read from the batches feeding the dish *now*, not from the
 * supply's current configuration: reconfiguring a supply later must never
 * reinterpret trays that were already cooked. When a dish is fed by both kinds
 * of batch the result is MIXED.
 */
export type MenuSellableInfo = {
  /** Total plates currently orderable for this dish. */
  plates: number;
  /** Plates coming from ALLOCATED splits (reserved for this dish). */
  allocated: number;
  /** Plates coming from SHARED pools (common to every dish on the supply). */
  shared: number;
  /** Engine of the live batches, or undefined when nothing is left. */
  sellingMode: SellingMode | "MIXED" | undefined;
};

/**
 * The plates of one dish that can currently be ordered, plus the engine that
 * produced them.
 *
 * ALLOCATED batches contribute their split remainders (never their unassigned
 * remainder — that is not sellable). SHARED batches contribute their whole
 * remaining pool, because the pool is sellable by every dish on the supply.
 */
export async function sellableInfoForMenu(
  tx: Prisma.TransactionClient,
  menuId: string,
): Promise<MenuSellableInfo> {
  const splitAgg = await tx.cookingRecordMenu.aggregate({
    where: { menuId },
    _sum: { platesRemaining: true },
  });
  const allocated = round2(Number(splitAgg._sum?.platesRemaining ?? 0));

  // A held-back link (excludedFromSharedPool) must not credit this dish with
  // the supply's shared pools, so the availability it sees downs to zero even
  // while the dish still appears on the menu.
  const links = await tx.stockSupplyMenu.findMany({
    where: { menuId },
    select: { stockSupplyId: true, excludedFromSharedPool: true },
  });
  const supplyIds = links.filter((l) => !l.excludedFromSharedPool).map((l) => l.stockSupplyId);

  let shared = 0;
  let sharedLive = false;
  if (supplyIds.length > 0) {
    const pools = await batchPools(tx, { sellingMode: SellingMode.SHARED, stockSupplyId: { in: supplyIds } });
    for (const pool of pools.values()) {
      shared = round2(shared + pool.poolRemaining);
      if (pool.poolRemaining > 0) sharedLive = true;
    }
  }

  const allocatedLive = allocated > 0;
  let sellingMode: MenuSellableInfo["sellingMode"];
  if (allocatedLive && sharedLive) sellingMode = "MIXED";
  else if (allocatedLive) sellingMode = SellingMode.ALLOCATED;
  else if (sharedLive) sellingMode = SellingMode.SHARED;

  return { plates: round2(allocated + shared), allocated, shared, sellingMode };
}

/** The plates of one dish that can currently be ordered. */
export async function sellableForMenu(
  tx: Prisma.TransactionClient,
  menuId: string,
): Promise<number> {
  return (await sellableInfoForMenu(tx, menuId)).plates;
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
  // A held-back link is Shared-only: it withholds the supply's shared pools
  // from this dish but leaves any ALLOCATED splits speaking for themselves.
  const links = await tx.stockSupplyMenu.findMany({
    where: { menuId },
    select: { stockSupplyId: true, excludedFromSharedPool: true },
  });
  const supplyIds = links.filter((l) => !l.excludedFromSharedPool).map((l) => l.stockSupplyId);

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

/**
 * Recompute `Menu.stock` for `menuId` and every sibling dish that shares one of
 * its stock supplies.
 *
 * A SHARED pool belongs to the supply and credits every linked dish, so a sale
 * through one dish drains the pool for all of them. Recomputing only the sold
 * menu would leave its siblings' mirrors frozen at the pool's old value.
 */
export async function recomputeMenuStockWithSiblings(
  tx: Prisma.TransactionClient,
  menuId: string,
): Promise<void> {
  const links = await tx.stockSupplyMenu.findMany({
    where: { menuId },
    select: { stockSupplyId: true },
  });
  const supplyIds = links.map((l) => l.stockSupplyId);
  if (supplyIds.length === 0) {
    await recomputeMenuStock(tx, menuId);
    return;
  }

  const siblings = await tx.stockSupplyMenu.findMany({
    where: { stockSupplyId: { in: supplyIds } },
    select: { menuId: true },
  });
  const menuIds = new Set<string>([menuId, ...siblings.map((s) => s.menuId)]);
  for (const id of menuIds) {
    await recomputeMenuStock(tx, id);
  }
}

/**
 * Discard `plates` of the SHARED pools belonging to `supplyIds`, oldest first,
 * by inflating each batch's `wastedPlates`. Because a pool is *derived* as
 * produced − sold − wasted, this is the only write needed: every linked dish's
 * sellable stock re-derives downward on the next recompute.
 *
 * Returns the amount still unwasted (0 when fully satisfied).
 */
async function wasteSharedPools(
  tx: Prisma.TransactionClient,
  supplyIds: string[],
  plates: number,
): Promise<number> {
  let left = round2(plates);
  if (left <= 0 || supplyIds.length === 0) return left;

  const pools = await batchPools(tx, {
    sellingMode: SellingMode.SHARED,
    stockSupplyId: { in: supplyIds },
  });
  const ordered = [...pools.values()]
    .filter((pool) => pool.poolRemaining > 0)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  for (const pool of ordered) {
    if (left <= 0) break;
    const take = round2(Math.min(pool.poolRemaining, left));
    if (take <= 0) continue;
    await tx.cookingRecord.update({
      where: { id: pool.id },
      data: { wastedPlates: { increment: take } },
    });
    left = round2(left - take);
  }
  return left;
}

/**
 * Discard `plates` of one dish's sellable stock as waste.
 *
 * ALLOCATED splits are drained FIFO. Each drained split loses the plates from
 * BOTH `platesAllocated` and `platesRemaining` so its sold figure
 * (allocated − remaining) is unchanged and the waste can never be mistaken for
 * a sale; the owning batch's `wastedPlates` grows by the same amount so the
 * derived pool drops too. Any remainder the dish cannot cover from its own
 * splits is taken from the SHARED pools it draws on.
 *
 * Returns the amount wasted (may be less than requested when the dish has less
 * sellable stock than asked).
 */
export async function wasteMenuPlates(
  tx: Prisma.TransactionClient,
  menuId: string,
  plates: number,
): Promise<number> {
  const original = round2(plates);
  if (original <= 0) return 0;
  let left = original;

  const splits = await tx.cookingRecordMenu.findMany({
    where: { menuId, platesRemaining: { gt: 0 } },
    select: {
      id: true,
      platesRemaining: true,
      cookingRecord: { select: { id: true, sellingMode: true } },
    },
    orderBy: { cookingRecord: { createdAt: "asc" } },
  });

  for (const split of splits) {
    if (left <= 0) break;
    if (split.cookingRecord.sellingMode !== SellingMode.ALLOCATED) continue;
    const take = round2(Math.min(Number(split.platesRemaining), left));
    if (take <= 0) continue;
    await tx.cookingRecordMenu.update({
      where: { id: split.id },
      data: {
        platesAllocated: { decrement: take },
        platesRemaining: { decrement: take },
      },
    });
    await tx.cookingRecord.update({
      where: { id: split.cookingRecord.id },
      data: { wastedPlates: { increment: take } },
    });
    left = round2(left - take);
  }

  if (left > 0) {
    const links = await tx.stockSupplyMenu.findMany({
      where: { menuId, excludedFromSharedPool: false },
      select: { stockSupplyId: true },
    });
    left = await wasteSharedPools(tx, links.map((l) => l.stockSupplyId), left);
  }

  return round2(original - left);
}

/**
 * Discard `plates` from one supply's SHARED pools as waste. This is the
 * supply-level counterpart of `wasteMenuPlates`, for when the manager decides on
 * a whole shared tray rather than one dish. Returns the amount wasted.
 */
export async function wasteSupplyPool(
  tx: Prisma.TransactionClient,
  stockSupplyId: string,
  plates: number,
): Promise<number> {
  const original = round2(plates);
  if (original <= 0) return 0;
  const left = await wasteSharedPools(tx, [stockSupplyId], original);
  return round2(original - left);
}