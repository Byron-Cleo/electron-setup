import { Router } from "express";
import prisma from "../db/db.js";
import { ServiceTime } from "../db/generated/prisma/client.js";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import { uploadsDir } from "../db/uploads.js";
import fs from "fs/promises";

const router = Router();

const VALID_MEAL_TYPES = Object.values(ServiceTime) as string[];

const menuImageStorage = multer.diskStorage({
  destination: uploadsDir("menu-items"),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
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
    ...rest
  } = menu
  return {
    ...rest,
    mealTypes: MenuMealType.map((mt: any) => mt.mealType),
    starch: starchRel,
    vegetable: vegetableRel,
  }
}

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
  const menuSplits = await prisma.cookingRecordMenu.findMany({
    where: {
      cookingRecord: { createdAt: { gte: shift.autoOpenTime, lt: windowEnd } },
    },
    select: {
      menuId: true,
      platesRemaining: true,
    },
  });
  const cookedByMenu = new Map<string, number>();
  for (const split of menuSplits) {
    cookedByMenu.set(split.menuId, (cookedByMenu.get(split.menuId) ?? 0) + Number(split.platesRemaining));
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

    const result = await Promise.all(records.map(async (record) => {
      const produced = Number(record.platesActual ?? record.platesExpected);
      const linkableMenus = record.stockSupply.menus.map((sm) => sm.menu);
      const splitByMenu = new Map(record.cookingRecordMenus.map((crm) => [crm.menuId, crm]));

      const allocatedTotal = record.cookingRecordMenus.reduce((sum, crm) => sum + Number(crm.platesAllocated), 0);
      const remainingTotal = record.cookingRecordMenus.reduce((sum, crm) => sum + Number(crm.platesRemaining), 0);

      // Sold applies only when the batch has been assigned (a plate cannot be
      // sold before it is put on a menu). Available mirrors the AssignmentModal's
      // Remaining Plates: produced - remaining - sold (or all produced when
      // unassigned since nothing could have been sold yet). platesAllocated
      // already includes sold plates (allocated = remaining + sold), so using
      // allocatedTotal here would subtract the sold plates twice.
      const soldTotal = allocatedTotal > 0
        ? linkableMenus.reduce((sum, menu) => sum + (soldByMenu.get(menu.id) ?? 0), 0)
        : 0;
      const availableTotal = allocatedTotal > 0
        ? produced - remainingTotal - soldTotal
        : produced;

      // Get current stock for the primary menu (first linkable menu)
      const primaryMenu = linkableMenus[0];
      const primaryMenuStock = primaryMenu ? await prisma.menu.findUnique({
        where: { id: primaryMenu.id },
        select: { stock: true, name: true }
      }) : null;

      return {
        id: record.id,
        cookedDate: record.cookedDate.toISOString().slice(0, 10),
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
          return {
            menuId: menu.id,
            menuName: menu.name,
            allocated: split ? Number(split.platesAllocated) : 0,
            remaining: split ? Number(split.platesRemaining) : 0,
          };
        }),
        cooking: {
          totalProduced: produced,
          totalAssigned: allocatedTotal,
          totalAvailable: availableTotal,
          totalSold: soldTotal,
        },
        platesRemaining: remainingTotal,
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
    },
    orderBy: { createdAt: "desc" },
  });

  const result = items.map(({
    MenuMealType,
    MenuAccompaniment_Menu_starchIdToMenuAccompaniment: starchRel,
    MenuAccompaniment_Menu_vegetableIdToMenuAccompaniment: vegetableRel,
    ...menu
  }) => ({
    ...menu,
    availablePlates: menu.stock,
    mealTypes: MenuMealType.map((mt) => mt.mealType),
    starch: starchRel,
    vegetable: vegetableRel,
  }));

  const filtered = mealType ? result.filter((item) => (item.availablePlates ?? 0) > 0) : result;

  res.json(filtered);
});

router.get("/images", async (_req, res) => {
  try {
    const dir = uploadsDir("menu-items");
    const files = await fs.readdir(dir);
    const images = files
      .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
      .sort()
      .map((f) => `/uploads/menu-items/${f}`);
    res.json({ images });
  } catch {
    res.status(500).json({ error: "Failed to list menu images" });
  }
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const item = await prisma.menu.findUnique({
    where: { id },
    include: {
      MenuMealType: { select: { mealType: true } },
      MenuAccompaniment_Menu_starchIdToMenuAccompaniment: { select: { name: true, price: true } },
      MenuAccompaniment_Menu_vegetableIdToMenuAccompaniment: { select: { name: true, price: true } },
    },
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
  const { name, slug, category, stock, price, mealTypes, hasStarch, hasVegetable, starchId, vegetableId, images } = req.body;
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

      return tx.menu.findUnique({
        where: { id: menu.id },
        include: {
          MenuMealType: { select: { mealType: true } },
          MenuAccompaniment_Menu_starchIdToMenuAccompaniment: { select: { name: true, price: true } },
          MenuAccompaniment_Menu_vegetableIdToMenuAccompaniment: { select: { name: true, price: true } },
        },
      });
    });

    res.status(201).json(serializeMenu(result));
  } catch (e: any) {
    if (e.code === "P2002") return res.status(409).json({ error: "Slug already exists" });
    throw e;
  }
});

router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, slug, category, stock, price, mealTypes, hasStarch, hasVegetable, starchId, vegetableId, images } = req.body;

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

      return tx.menu.findUnique({
        where: { id },
        include: {
          MenuMealType: { select: { mealType: true } },
          MenuAccompaniment_Menu_starchIdToMenuAccompaniment: { select: { name: true, price: true } },
          MenuAccompaniment_Menu_vegetableIdToMenuAccompaniment: { select: { name: true, price: true } },
        },
      });
    });

    res.json(serializeMenu(result));
  } catch (e: any) {
    if (e.code === "P2025") return res.status(404).json({ error: "Not found" });
    if (e.code === "P2002") return res.status(409).json({ error: "Slug already exists" });
    throw e;
  }
});

router.put("/:id/availability", async (req, res) => {
  const { id } = req.params;
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
  try {
    await prisma.menu.delete({ where: { id } });
    res.json({ message: "Deleted", id });
  } catch (e: any) {
    if (e.code === "P2025") return res.status(404).json({ error: "Not found" });
    throw e;
  }
});

export default router;
