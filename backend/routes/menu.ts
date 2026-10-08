import { Router } from "express";
import prisma from "../db/db.js";
import { computeCurrentCycle, computeAllUnassignedBatches } from "./shiftCarryOver.js";
import { Prisma, ServiceTime } from "../db/generated/prisma/client.js";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import { uploadsDir } from "../db/uploads.js";
import { batchPools, round2, sellableInfoForMenu, soldByMenuForBatches } from "../pools.js";
import fs from "fs/promises";

const router = Router();

const VALID_MEAL_TYPES = Object.values(ServiceTime) as string[];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A portion option (Fried Eggs "1 pc" / "2 pc"), ready to be written.
 *
 * Portions are dish-owned — MenuAccompaniment.menuId — rather than entries in
 * the global accompaniment list, because "1 pc" means nothing outside the dish
 * it belongs to. They are edited on MenuForm and therefore arrive as a nested
 * payload on POST/PUT /menu, never through /accompaniments.
 */
interface NormalizedPortion {
  id?: string;
  name: string;
  price: number;
  platesPerServing: number;
  isDefault: boolean;
}

/**
 * Validates the request's portion payload before anything touches the
 * transaction, returning an error string so both POST and PUT can 400 the same
 * way instead of failing half-way through a write.
 */
function parsePortions(
  input: unknown,
): { error: string } | { portions: NormalizedPortion[] } {
  if (!Array.isArray(input)) return { error: "portions must be an array" };

  const portions: NormalizedPortion[] = [];
  let defaults = 0;

  for (const raw of input) {
    if (!raw || typeof raw !== "object") return { error: "each portion must be an object" };

    const { id, name, price, platesPerServing, isDefault } = raw as Record<string, unknown>;
    const trimmed = typeof name === "string" ? name.trim() : "";
    if (!trimmed) return { error: "each portion needs a name" };

    const amount = Number(price ?? 0);
    if (!Number.isFinite(amount) || amount < 0) {
      return { error: `portion "${trimmed}" needs a price of 0 or more` };
    }

    const plates = Number(platesPerServing ?? 1);
    if (!Number.isFinite(plates) || plates <= 0) {
      return { error: `portion "${trimmed}" needs platesPerServing greater than 0` };
    }

    if (id !== undefined && (typeof id !== "string" || !UUID_RE.test(id))) {
      return { error: `portion "${trimmed}" has an invalid id` };
    }

    if (isDefault === true) defaults += 1;
    portions.push({
      id: typeof id === "string" ? id : undefined,
      name: trimmed,
      price: amount,
      platesPerServing: plates,
      isDefault: isDefault === true,
    });
  }

  if (defaults > 1) return { error: "only one portion can be the default" };
  return { portions };
}

/**
 * Writes a dish's portion options inside the caller's transaction.
 *
 * The order of operations is load-bearing. Menu.portionId and
 * OrderItem.portionId are both ON DELETE SET NULL, so deleting a row first
 * would quietly detach it — losing the default pointer, and scrubbing the
 * portion's name off historical receipts — rather than failing loudly. So:
 * upsert every kept row, move the dish's pointer onto a row that now exists,
 * and only then delete what was removed (refusing if orders still name it).
 */
async function syncPortions(
  tx: Prisma.TransactionClient,
  menuId: string,
  portions: NormalizedPortion[],
): Promise<void> {
  const keptIds: string[] = [];

  for (const portion of portions) {
    if (portion.id) {
      // Scoped to this dish: adopting another dish's row would move it out
      // from under whoever owns it, so reject the whole payload instead.
      const owned = await tx.menuAccompaniment.findFirst({
        where: { id: portion.id, menuId, category: "PORTION" },
        select: { id: true },
      });
      if (!owned) {
        throw Object.assign(new Error(`Unknown portion id: ${portion.id}`), { status: 400 });
      }

      await tx.menuAccompaniment.update({
        where: { id: portion.id },
        data: {
          name: portion.name,
          price: portion.price,
          platesPerServing: portion.platesPerServing,
          isDefault: portion.isDefault,
        },
      });
      keptIds.push(portion.id);
    } else {
      const created = await tx.menuAccompaniment.create({
        data: {
          name: portion.name,
          category: "PORTION",
          image: "",
          price: portion.price,
          platesPerServing: portion.platesPerServing,
          isDefault: portion.isDefault,
          menuId,
        },
      });
      keptIds.push(created.id);
    }
  }

  // With no explicit default, the first option is the default — which is what
  // the waiter's defaultPortionFor() falls back to anyway, so pin it down.
  const defaultIndex = portions.findIndex((p) => p.isDefault);
  const defaultId = keptIds[defaultIndex >= 0 ? defaultIndex : keptIds.length > 0 ? 0 : -1];

  await tx.menu.update({
    where: { id: menuId },
    data: { hasPortion: portions.length > 0, portionId: defaultId ?? null },
  });

  const where: Prisma.MenuAccompanimentWhereInput = { menuId, category: "PORTION" };
  if (keptIds.length > 0) where.id = { notIn: keptIds };

  const removed = await tx.menuAccompaniment.findMany({
    where,
    select: {
      id: true,
      name: true,
      _count: { select: { OrderItem_portionIdToMenuAccompaniment: true } },
    },
  });

  const inUse = removed.find((r) => r._count.OrderItem_portionIdToMenuAccompaniment > 0);
  if (inUse) {
    throw Object.assign(
      new Error(`"${inUse.name}" is used by past orders and can't be removed`),
      { status: 409 },
    );
  }

  if (removed.length > 0) {
    await tx.menuAccompaniment.deleteMany({ where: { id: { in: removed.map((r) => r.id) } } });
  }
}

// Keep a readable, sanitized copy of the original filename at the end so the
// waiter gallery's endsWith-based accompaniment matching works for uploaded
// images (e.g. "beef fry ugali.png" -> "3f9c…-beef-fry-ugali.png").
function sanitizeImageName(originalName: string): string {
  const ext = path.extname(originalName);
  const base = path.basename(originalName, ext);
  return base
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const menuImageStorage = multer.diskStorage({
  destination: uploadsDir("menu-items"),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const readable = sanitizeImageName(file.originalname);
    cb(null, `${crypto.randomUUID()}-${readable}${ext}`);
  },
});

const uploadMenuImage = multer({
  storage: menuImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    cb(null, allowed.includes(file.mimetype));
  },
});

function serializeMenu(menu: any) {
  const {
    MenuMealType,
    MenuAccompaniment_Menu_starchIdToMenuAccompaniment: starchRel,
    MenuAccompaniment_Menu_vegetableIdToMenuAccompaniment: vegetableRel,
    portionOptions,
    ...rest
  } = menu
  return {
    ...rest,
    mealTypes: MenuMealType.map((mt: any) => mt.mealType),
    starch: starchRel,
    vegetable: vegetableRel,
    ...(portionOptions !== undefined && {
      // Prisma Decimal serialises as a string; the client types these numbers.
      portionOptions: portionOptions.map(
        (p: { id: string; name: string; price?: unknown; platesPerServing?: unknown }) => ({
          ...p,
          price: Number(p.price ?? 0),
          platesPerServing: Number(p.platesPerServing ?? 1),
        }),
      ),
      // Same pointer the list endpoint exposes, so MenuForm's edit mode and the
      // waiter agree on which option is preselected.
      defaultPortionId: menu.portionId ?? null,
      hasPortion: portionOptions.length > 0,
    }),
  }
}

// Column set every menu-shaped response is built from, including the dish's
// own portion options (MENU.portionOptions) so edit round-trips are lossless.
const MENU_INCLUDE = {
  MenuMealType: { select: { mealType: true } },
  MenuAccompaniment_Menu_starchIdToMenuAccompaniment: { select: { name: true, price: true } },
  MenuAccompaniment_Menu_vegetableIdToMenuAccompaniment: { select: { name: true, price: true } },
  portionOptions: {
    where: { category: "PORTION" as const },
    orderBy: { price: "asc" as const },
    select: { id: true, name: true, price: true, platesPerServing: true },
  },
} satisfies Prisma.MenuInclude;

const RUNNING_LOW_THRESHOLD = 5;

// Builds the current shift's stock status per menu item. If mealType is
// provided, only menus linked to that meal period are included. Mirrors the
// shift report's plate-movement attribution: cooking records are attributed to
// the shift whose [autoOpenTime, nextShift.autoOpenTime ?? autoCloseTime) window
// their createdAt falls in.
async function getShiftBasedStockStatus(mealType?: string) {
  const shift = await prisma.shift.findFirst({
    where: { isOpen: true },
    orderBy: { createdAt: "desc" },
    include: { snapshots: true },
  });

  if (!shift) {
    return { shift: null, mealType: mealType ?? null, selling: [], soldOut: [], runningLow: [] };
  }

  const nextShift = await prisma.shift.findFirst({
    where: { autoOpenTime: { gt: shift.autoOpenTime }, operationDay: shift.operationDay },
    orderBy: { autoOpenTime: "asc" },
    select: { autoOpenTime: true },
  });
  const windowEnd = nextShift?.autoOpenTime ?? shift.autoCloseTime;

  // Plate-movement context for the current shift (used only to show produced /
  // sold alongside the live stock — the Selling/Sold Out/Running Low buckets are
  // driven purely by live Menu.stock so they match exactly what the waiter sees).
  // `produced` = Σ platesAllocated (what actually entered menu stock this shift),
  // mirroring the shift report — NOT platesRemaining, which also includes sold.
  const menuSplits = await prisma.cookingRecordMenu.findMany({
    where: {
      cookingRecord: { createdAt: { gte: shift.autoOpenTime, lt: windowEnd } },
    },
    select: {
      menuId: true,
      platesAllocated: true,
    },
  });
  const cookedByMenu = new Map<string, number>();
  for (const split of menuSplits) {
    cookedByMenu.set(split.menuId, (cookedByMenu.get(split.menuId) ?? 0) + Number(split.platesAllocated));
  }

  // Plates that can still be assigned right now: the current operation date's
  // valid unassigned pools, credited to every menu the pool's stock item produces.
  let assignableByMenu = new Map<string, number>();
  const cycle = await computeCurrentCycle();
  if (cycle) {
    const { batches: validBatches } = await computeAllUnassignedBatches(cycle);
    assignableByMenu = new Map<string, number>();
    for (const batch of validBatches) {
      for (const menuId of batch.linkableMenus) {
        assignableByMenu.set(menuId, (assignableByMenu.get(menuId) ?? 0) + batch.unassigned);
      }
    }
  }

  const soldByMenu = new Map<string, number>();
  const openingByMenu = new Map<string, number>();
  for (const snap of shift.snapshots) {
    openingByMenu.set(snap.menuId, Number(snap.openingPlates) || 0);
    soldByMenu.set(snap.menuId, (soldByMenu.get(snap.menuId) ?? 0) + Number(snap.platesSold));
  }

  // The menu pool — same availability + meal-period filter the waiter uses.
  const menus = await prisma.menu.findMany({
    where: {
      isAvailable: true,
      ...(mealType ? { MenuMealType: { some: { mealType: mealType as ServiceTime } } } : {}),
    },
    select: {
      id: true,
      name: true,
      category: true,
      stock: true,
      MenuMealType: { select: { mealType: true } },
    },
  });

  const rows = menus.map((menu) => {
    const onHand = Number(menu.stock);
    return {
      id: menu.id,
      name: menu.name,
      category: menu.category,
      mealTypes: menu.MenuMealType.map((mt) => mt.mealType),
      produced: cookedByMenu.get(menu.id) ?? 0,
      sold: soldByMenu.get(menu.id) ?? 0,
      assignable: assignableByMenu.get(menu.id) ?? 0,
      remaining: onHand,
      opening: openingByMenu.get(menu.id) ?? 0,
    };
  });

  // Selling = what the waiter can actually order right now (live stock > 0).
  const selling = rows.filter((r) => r.remaining > 0);
  const runningLow = selling.filter((r) => r.remaining <= RUNNING_LOW_THRESHOLD);
  // Sold Out = dishes that have been on production (assigned plates / opened
  // with stock) but currently have none left. Menus with ANY assigned split are
  // included — not just splits within this shift's window — so carried-over
  // dishes that sell out mid-shift are still captured. Menu that merely have an
  // idle snapshot (openingPlates = 0) and no production are excluded.
  const allocatedSplits = await prisma.cookingRecordMenu.findMany({
    where: { platesAllocated: { gt: 0 } },
    select: { menuId: true },
  });
  const inProduction = new Set<string>([
    ...allocatedSplits.map((s) => s.menuId),
    ...[...openingByMenu.entries()].filter(([, v]) => v > 0).map(([k]) => k),
    ...selling.map((r) => r.id),
  ]);
  const soldOut = rows.filter((r) => r.remaining <= 0 && inProduction.has(r.id));

  return { shift, mealType: mealType ?? null, selling, soldOut, runningLow };
}

// GET /api/menu/stock-status?mealType=LUNCH - Current shift's Selling / Sold Out / Running Low
router.get("/stock-status", async (req, res) => {
  try {
    const { mealType } = req.query;
    if (mealType && !VALID_MEAL_TYPES.includes(mealType as string)) {
      return res.status(400).json({ error: `Invalid mealType: ${mealType}. Must be one of: ${VALID_MEAL_TYPES.join(", ")}` });
    }
    const status = await getShiftBasedStockStatus(mealType as string | undefined);
    res.json(status);
  } catch (e) {
    console.error("Error fetching stock status:", e);
    res.status(500).json({ error: "Failed to fetch stock status" });
  }
});

router.get("/cooked", async (req, res) => {
  try {
    const { date } = req.query;
    const dateFilter: Record<string, unknown> = {}
    if (date) {
      const d = new Date(date as string)
      if (isNaN(d.getTime())) {
        return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" })
      }
      dateFilter.cookedDate = d
    } else {
      // No date = "today's cooked food": scope to the CURRENT operation-date
      // cycle (day + night, anchored at the morning auto-open) by createdAt.
      // Past-op-date batches are handled separately by Remaining Stock Production.
      const cycle = await computeCurrentCycle();
      if (cycle) {
        dateFilter.createdAt = { gte: cycle.cycleStart, lt: cycle.cycleEnd };
      }
    }

    // Kitchen production = cooked batches. Show every batch produced (whether or
    // not its plates have been allocated yet) so the admin can assign them.
    const records = await prisma.cookingRecord.findMany({
      where: dateFilter,
      include: {
        stockSupply: {
          select: {
            id: true,
            name: true,
            unit: true,
            platesPerUnit: true,
            image: true,
            menus: { include: { menu: { select: { id: true, name: true } } } },
          },
        },
        cookingRecordMenus: {
          include: { menu: { select: { id: true, name: true } } },
          orderBy: { createdAt: "asc" },
        },
        shift: { select: { id: true, type: true, operationDay: true, autoOpenTime: true, autoCloseTime: true } },
      },
      orderBy: { cookedDate: "desc" },
    });

    // Sold is captured per shift in the current open shift's snapshots. The
    // modal's "Remaining Plates" = produced - allocated - sold, so the table's
    // "Available" must subtract the same sold value to stay consistent.
    const openShift = await prisma.shift.findFirst({
      where: { isOpen: true },
      orderBy: { createdAt: "desc" },
      include: { snapshots: true },
    });
    const soldByMenu = new Map<string, number>();
    if (openShift) {
      for (const snap of openShift.snapshots) {
        soldByMenu.set(snap.menuId, (soldByMenu.get(snap.menuId) ?? 0) + Number(snap.platesSold));
      }
    }

    // Shared batches' remaining pools in one aggregate query (produced − sold −
    // wasted), so the cooked table shows a ledger-derived number per batch.
    const sharedIds = records.filter((r) => r.sellingMode === "SHARED").map((r) => r.id);
    const sharedPools =
      sharedIds.length > 0 ? await batchPools(prisma, { id: { in: sharedIds } }) : new Map();

    // Per-dish sold per batch, straight from the allocation ledger. A SHARED
    // pool has no splits, so this is the only per-dish trace for it.
    const batchSoldByMenu =
      records.length > 0 ? await soldByMenuForBatches(prisma, records.map((r) => r.id)) : new Map();

    const result = await Promise.all(records.map(async (record) => {
      const produced = Number(record.platesActual ?? record.platesExpected);
      const linkableMenus = record.stockSupply.menus.map((sm) => sm.menu);
      const splitByMenu = new Map(record.cookingRecordMenus.map((crm) => [crm.menuId, crm]));

      const allocatedTotal = record.cookingRecordMenus.reduce((sum, crm) => sum + Number(crm.platesAllocated), 0);
      const remainingTotal = record.cookingRecordMenus.reduce((sum, crm) => sum + Number(crm.platesRemaining), 0);

      // Two different questions, previously conflated into one number:
      //
      //  - assignmentCapacity — how many MORE plates a manager may hand to a
      //    dish. Plates already allocated to another dish are spoken for, so
      //    this is produced - allocated, not what is left to sell.
      //  - sellableRemaining — what a waiter can still order. For ALLOCATED
      //    that is the split remainders; for SHARED it is the derived pool.
      const isShared = record.sellingMode === "SHARED";
      const assignmentCapacity = Math.max(0, produced - allocatedTotal);
      // SHARED remainders are derived (produced − sold − wasted), never cached —
      // the ledger is the only source of truth across restarts and shifts.
      const sellableRemaining = isShared
        ? (sharedPools.get(record.id)?.poolRemaining ?? produced)
        : remainingTotal;
      const soldTotal = isShared
        ? Math.max(0, produced - sellableRemaining)
        : allocatedTotal > 0
          ? Math.max(0, allocatedTotal - remainingTotal)
          : 0;

      // Get current stock for the primary menu (first linkable menu)
      const primaryMenu = linkableMenus[0];
      const primaryMenuStock = primaryMenu ? await prisma.menu.findUnique({
        where: { id: primaryMenu.id },
        select: { stock: true, name: true }
      }) : null;

      return {
        id: record.id,
        disposed: record.disposed,
        disposedAt: record.disposedAt ? record.disposedAt.toISOString() : null,
        cookedDate: record.cookedDate.toISOString().slice(0, 10),
        shiftId: record.shift?.id ?? null,
        shiftType: record.shift?.type ?? null,
        operationDay: record.shift ? record.shift.operationDay.toISOString().slice(0, 10) : null,
        cookedAt: record.createdAt.toISOString(),
        batchNumber: record.batchNumber ?? null,
        quantityCooked: Number(record.quantityCooked),
        produced,
        stockSupply: {
          id: record.stockSupply.id,
          name: record.stockSupply.name,
          unit: record.stockSupply.unit,
          platesPerUnit: record.stockSupply.platesPerUnit,
          image: record.stockSupply.image,
        },
        // Top-level fields for EditMenuDialog compatibility
        name: primaryMenuStock?.name ?? record.stockSupply.name,
        stock: primaryMenuStock?.stock ?? 0,
        menus: linkableMenus.map((menu) => {
          const split = splitByMenu.get(menu.id);
          // Sold per dish — ALLOCATED reads split remainders, SHARED reads the
          // allocation ledger because the shared pool has no splits to subtract.
          const sold = isShared
            ? Math.max(0, round2(batchSoldByMenu.get(record.id)?.get(menu.id)?.sold ?? 0))
            : split
              ? Math.max(0, round2(Number(split.platesAllocated) - Number(split.platesRemaining)))
              : 0;
          return {
            menuId: menu.id,
            menuName: menu.name,
            allocated: split ? Number(split.platesAllocated) : 0,
            remaining: split ? Number(split.platesRemaining) : 0,
            sold,
          };
        }),
        cooking: {
          totalProduced: produced,
          totalAssigned: allocatedTotal,
          // Kept as the field the AssignmentModal reads, now with the correct
          // meaning: how much more can be allocated.
          totalAvailable: assignmentCapacity,
          totalSold: soldTotal,
          sellableRemaining,
          assignmentCapacity,
        },
        sellingMode: record.sellingMode,
        // No allocation step exists for a shared batch.
        canAssign: !isShared,
        platesRemaining: sellableRemaining,
        cookingRecords: record.cookingRecordMenus.map((crm) => ({
          id: crm.cookingRecordId,
          menuId: crm.menuId,
          cookedDate: record.cookedDate.toISOString().slice(0, 10),
          plates: Number(crm.platesAllocated),
          platesRemaining: Number(crm.platesRemaining),
        })),
      };
    }));

    res.json(result);
  } catch (e) {
    console.error("Error fetching cooked menus:", e);
    res.status(500).json({ error: "Failed to fetch cooked menus" });
  }
});

// GET /api/menu/running-low-count - Count menu items running low (≤ RUNNING_LOW_THRESHOLD plates)
router.get("/running-low-count", async (_req, res) => {
  try {
    const status = await getShiftBasedStockStatus(undefined);
    res.json({ count: status.runningLow.length });
  } catch (e) {
    console.error("Error counting running-low menus:", e);
    res.status(500).json({ error: "Failed to count running-low menus" });
  }
});

router.get("/", async (req, res) => {
  const { mealType } = req.query;

  const where: Record<string, unknown> = {};
  if (mealType) {
    if (!VALID_MEAL_TYPES.includes(mealType as string)) {
      res.status(400).json({ error: `Invalid mealType: ${mealType}. Must be one of: ${VALID_MEAL_TYPES.join(", ")}` });
      return;
    }
    where.isAvailable = true;
    where.MenuMealType = { some: { mealType: mealType as string } };
  }

  const items = await prisma.menu.findMany({
    where,
    include: {
      MenuMealType: { select: { mealType: true } },
      MenuAccompaniment_Menu_starchIdToMenuAccompaniment: { select: { name: true, price: true } },
      MenuAccompaniment_Menu_vegetableIdToMenuAccompaniment: { select: { name: true, price: true } },
      // Portion sizes (Fried Eggs 1pc / 2pc). These are dish-owned options, not
      // the starch/vegetable relations above.
      portionOptions: {
        where: { category: "PORTION" },
        orderBy: { price: "asc" },
        select: { id: true, name: true, price: true, platesPerServing: true },
      },
      stockSupplyMenus: {
        select: {
          platesPerServing: true,
          stockSupply: { select: { id: true, sellingMode: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Availability comes from the pool ledger, not the Menu.stock mirror, so a
  // shared pool is credited in full to every dish on its supply. The engine is
  // read from the live batches too, so a supply reconfigured after cooking never
  // relabels trays that were already produced under the other engine.
  const availability = await Promise.all(
    items.map((menu) => sellableInfoForMenu(prisma, menu.id)),
  );

  const result = items.map(({
    MenuMealType,
    MenuAccompaniment_Menu_starchIdToMenuAccompaniment: starchRel,
    MenuAccompaniment_Menu_vegetableIdToMenuAccompaniment: vegetableRel,
    portionOptions,
    stockSupplyMenus,
    ...menu
  }, index) => {
    const plates = availability[index]?.plates ?? 0;
    // Per-dish factor: the max across its feeds keeps the served cap honest.
    const dishRates = stockSupplyMenus
      .map((l) => Number(l.platesPerServing))
      .filter((n) => n > 0);
    const supplyFactor = dishRates.length > 0 ? Math.max(...dishRates) : 1;
    // A dish sold in portions takes its rate from the default portion, not the
    // supply link, so the returned servings match what the waiter sees when
    // that portion is preselected.
    const defaultPortion =
      portionOptions.find((p) => p.id === menu.portionId) ?? portionOptions[0];
    const portionFactor = defaultPortion ? Number(defaultPortion.platesPerServing) : 0;
    const platesPerServing = portionFactor > 0 ? portionFactor : supplyFactor;

    return {
      ...menu,
      // Prisma Decimal does not survive JSON as a number; normalise explicitly.
      stock: Number(menu.stock),
      availablePlates: plates,
      platesPerServing,
      // Whole servings only — a partial plate is not orderable.
      sellableServings: Math.floor(plates / platesPerServing),
      // The engine of the batches actually feeding this dish, not the supply's
      // current configuration: ALLOCATED, SHARED, MIXED, or undefined when sold out.
      sellingMode: availability[index]?.sellingMode,
      allocatedPlates: availability[index]?.allocated ?? 0,
      sharedPlates: availability[index]?.shared ?? 0,
      supplyNames: stockSupplyMenus.map((l) => l.stockSupply.name),
      hasPortion: portionOptions.length > 0,
      portionId: menu.portionId,
      defaultPortionId: menu.portionId,
      defaultQty: Number(menu.defaultQty ?? 1),
      portionOptions: portionOptions.map((p) => ({
        ...p,
        // Prisma Decimal serialises as a string; every caller does price maths.
        price: Number(p.price ?? 0),
        platesPerServing: Number(p.platesPerServing ?? 1),
      })),
      mealTypes: MenuMealType.map((mt) => mt.mealType),
      starch: starchRel,
      vegetable: vegetableRel,
    };
  });

  const filtered = mealType ? result.filter((item) => Number(item.availablePlates ?? 0) > 0) : result;

  res.json(filtered);
});

router.get("/images", async (_req, res) => {
  try {
    // The login carousel feeds from this endpoint. List every image a form
    // upload can produce — menu items and menu accompaniments — so both the
    // Menu and Accompaniment admin forms automatically feed the carousel.
    const subdirs = ["menu-items", "menu-accompaniments"];
    const images: string[] = [];
    for (const sub of subdirs) {
      let files: string[] = [];
      try {
        files = await fs.readdir(uploadsDir(sub));
      } catch {
        files = [];
      }
      images.push(
        ...files
          .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
          .sort()
          .map((f) => `/uploads/${sub}/${f}`),
      );
    }
    res.json({ images });
  } catch {
    res.status(500).json({ error: "Failed to list menu images" });
  }
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  // Prisma parses the where-clause id itself and throws P2007 on a non-UUID,
  // which the catch below would re-throw into an unhandled rejection and exit
  // the process. A non-UUID can never name a menu, so 404 before we get there.
  if (!UUID_RE.test(id)) return res.status(404).json({ error: "Not found" });
  const item = await prisma.menu.findUnique({
    where: { id },
    include: MENU_INCLUDE,
  });
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json(serializeMenu(item));
});

router.post("/upload", uploadMenuImage.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image file uploaded (jpeg/png/webp, max 5MB)" });
  }
  res.status(201).json({ url: `/uploads/menu-items/${req.file.filename}` });
});

router.post("/", async (req, res) => {
  const { name, slug, category, stock, price, mealTypes, hasStarch, hasVegetable, starchId, vegetableId, images, portions } = req.body;
  if (!name || !category) {
    return res.status(400).json({ error: "name, category are required" });
  }

  if (images !== undefined && !Array.isArray(images)) {
    return res.status(400).json({ error: "images must be an array of strings" });
  }

  if (mealTypes) {
    if (!Array.isArray(mealTypes)) {
      return res.status(400).json({ error: "mealTypes must be an array" });
    }
    for (const mt of mealTypes) {
      if (!VALID_MEAL_TYPES.includes(mt)) {
        return res.status(400).json({ error: `Invalid mealType: ${mt}. Must be one of: ${VALID_MEAL_TYPES.join(", ")}` });
      }
    }
  }

  if (hasStarch && !starchId) {
    return res.status(400).json({ error: "starchId is required when hasStarch is true" });
  }
  if (hasVegetable && !vegetableId) {
    return res.status(400).json({ error: "vegetableId is required when hasVegetable is true" });
  }

  let normalizedPortions: NormalizedPortion[] | undefined;
  if (portions !== undefined) {
    const parsed = parsePortions(portions);
    if ("error" in parsed) return res.status(400).json({ error: parsed.error });
    normalizedPortions = parsed.portions;
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const menu = await tx.menu.create({
        data: {
          name,
          slug: slug || name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
          category,
          stock: stock ?? undefined,
          price: price ?? 0,
          images: images ?? [],
          hasStarch: hasStarch ?? false,
          hasVegetable: hasVegetable ?? false,
          starchId: starchId ?? null,
          vegetableId: vegetableId ?? null,
        },
      });

      if (mealTypes?.length > 0) {
        await tx.menuMealType.createMany({
          data: mealTypes.map((mt: string) => ({
            menuId: menu.id,
            mealType: mt,
          })),
        });
      }

      if (normalizedPortions !== undefined) {
        await syncPortions(tx, menu.id, normalizedPortions);
      }

      return tx.menu.findUnique({
        where: { id: menu.id },
        include: MENU_INCLUDE,
      });
    });

    res.status(201).json(serializeMenu(result));
  } catch (e: any) {
    if (e.code === "P2002") return res.status(409).json({ error: "Slug already exists" });
    if (typeof e?.status === "number") return res.status(e.status).json({ error: e.message });
    throw e;
  }
});

router.put("/:id", async (req, res) => {
  const { id } = req.params;
  if (!UUID_RE.test(id)) return res.status(404).json({ error: "Not found" });
  const { name, slug, category, stock, price, mealTypes, hasStarch, hasVegetable, starchId, vegetableId, images, portions } = req.body;

  if (images !== undefined && !Array.isArray(images)) {
    return res.status(400).json({ error: "images must be an array of strings" });
  }

  if (mealTypes) {
    if (!Array.isArray(mealTypes)) {
      return res.status(400).json({ error: "mealTypes must be an array" });
    }
    for (const mt of mealTypes) {
      if (!VALID_MEAL_TYPES.includes(mt)) {
        return res.status(400).json({ error: `Invalid mealType: ${mt}. Must be one of: ${VALID_MEAL_TYPES.join(", ")}` });
      }
    }
  }

  // Validated before the first read so a bad payload 400s without doing any
  // work; omitted entirely means "leave this dish's portions alone".
  let normalizedPortions: NormalizedPortion[] | undefined;
  if (portions !== undefined) {
    const parsed = parsePortions(portions);
    if ("error" in parsed) return res.status(400).json({ error: parsed.error });
    normalizedPortions = parsed.portions;
  }

  try {
    const existing = await prisma.menu.findUnique({
      where: { id },
      select: {
        hasStarch: true,
        hasVegetable: true,
        starchId: true,
        vegetableId: true,
        MenuMealType: { select: { mealType: true } },
      },
    });
    if (!existing) return res.status(404).json({ error: "Not found" });

    const effectiveHasStarch = hasStarch !== undefined ? hasStarch : existing.hasStarch;
    const effectiveHasVegetable = hasVegetable !== undefined ? hasVegetable : existing.hasVegetable;
    const effectiveStarchId = starchId !== undefined ? starchId : existing.starchId;
    const effectiveVegetableId = vegetableId !== undefined ? vegetableId : existing.vegetableId;

    if (effectiveHasStarch && !effectiveStarchId) {
      return res.status(400).json({ error: "starchId is required when hasStarch is true" });
    }
    if (effectiveHasVegetable && !effectiveVegetableId) {
      return res.status(400).json({ error: "vegetableId is required when hasVegetable is true" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const data: Record<string, unknown> = {
        ...(name !== undefined && { name }),
        ...(slug !== undefined && { slug }),
        ...(category !== undefined && { category }),
        ...(stock !== undefined && { stock }),
        ...(price !== undefined && { price }),
        ...(images !== undefined && { images }),
        ...(hasStarch !== undefined && { hasStarch }),
        ...(hasVegetable !== undefined && { hasVegetable }),
        ...(starchId !== undefined && { starchId: starchId ?? null }),
        ...(vegetableId !== undefined && { vegetableId: vegetableId ?? null }),
      };

      await tx.menu.update({
        where: { id },
        data,
      });

      if (mealTypes !== undefined) {
        await tx.menuMealType.deleteMany({ where: { menuId: id } });

        if (mealTypes.length > 0) {
          await tx.menuMealType.createMany({
            data: mealTypes.map((mt: string) => ({
              menuId: id,
              mealType: mt,
            })),
          });
        }
      }

      if (normalizedPortions !== undefined) {
        await syncPortions(tx, id, normalizedPortions);
      }

      return tx.menu.findUnique({
        where: { id },
        include: MENU_INCLUDE,
      });
    });

    res.json(serializeMenu(result));
  } catch (e: any) {
    if (e.code === "P2025") return res.status(404).json({ error: "Not found" });
    if (e.code === "P2002") return res.status(409).json({ error: "Slug already exists" });
    if (typeof e?.status === "number") return res.status(e.status).json({ error: e.message });
    throw e;
  }
});

router.put("/:id/availability", async (req, res) => {
  const { id } = req.params;
  if (!UUID_RE.test(id)) return res.status(404).json({ error: "Not found" });
  const { isAvailable } = req.body;
  if (typeof isAvailable !== "boolean") {
    return res.status(400).json({ error: "isAvailable must be a boolean" });
  }
  try {
    const item = await prisma.menu.update({
      where: { id },
      data: { isAvailable },
    });
    res.json(item);
  } catch (e: any) {
    if (e.code === "P2025") return res.status(404).json({ error: "Not found" });
    throw e;
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  if (!UUID_RE.test(id)) return res.status(404).json({ error: "Not found" });
  try {
    await prisma.menu.delete({ where: { id } });
    res.json({ message: "Deleted", id });
  } catch (e: any) {
    if (e.code === "P2025") return res.status(404).json({ error: "Not found" });
    throw e;
  }
});

export default router;
