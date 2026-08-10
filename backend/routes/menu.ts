import { Router } from "express";
import prisma from "../db/db.js";
import { ServiceTime } from "../db/generated/prisma/client.js";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const router = Router();

const VALID_MEAL_TYPES = Object.values(ServiceTime) as string[];

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const menuImageStorage = multer.diskStorage({
  destination: path.resolve(__dirname, "../uploads/menu-items"),
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

router.get("/cooked", async (req, res) => {
  try {
    const { date } = req.query;
    let dateFilter: Record<string, unknown> = {}
    if (date) {
      const d = new Date(date as string)
      if (isNaN(d.getTime())) {
        return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" })
      }
      const nextDay = new Date(d)
      nextDay.setDate(nextDay.getDate() + 1)
      dateFilter.cookedDate = { gte: d, lt: nextDay }
    }

    const menus = await prisma.menu.findMany({
      where: {
        stockSupplyMenus: {
          some: {
            stockSupply: {
              isMenuStock: true,
              CookingRecord: { some: {} },
            },
          },
        },
      },
      include: {
        stockSupplyMenus: {
          where: { stockSupply: { isMenuStock: true } },
          include: {
            stockSupply: { select: { id: true, name: true, unit: true, platesPerUnit: true, image: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = await Promise.all(
      menus.map(async (menu) => {
        const stockSupplyIds = menu.stockSupplyMenus.map((sm) => sm.stockSupply.id);

        const cookingRecords = await prisma.cookingRecord.findMany({
          where: { stockSupplyId: { in: stockSupplyIds }, ...dateFilter },
          select: { platesActual: true, platesExpected: true },
        });

        let totalProduced = 0;
        for (const record of cookingRecords) {
          totalProduced += Number(record.platesActual ?? record.platesExpected);
        }

        const relatedMenus = await prisma.menu.findMany({
          where: {
            stockSupplyMenus: {
              some: { stockSupplyId: { in: stockSupplyIds } },
            },
          },
          select: { stock: true },
        });

        const totalAssigned = relatedMenus.reduce(
          (sum, m) => sum + (m.stock ?? 0),
          0
        );

        return {
          id: menu.id,
          name: menu.name,
          slug: menu.slug,
          category: menu.category,
          price: Number(menu.price),
          stock: menu.stock,
          isAvailable: menu.isAvailable,
          images: menu.images,
          stockSupply: menu.stockSupplyMenus[0]?.stockSupply ?? null,
          cooking: {
            totalProduced,
            totalAssigned,
            totalAvailable: totalProduced - totalAssigned,
          },
        };
      })
    );

    res.json(result);
  } catch (e) {
    console.error("Error fetching cooked menus:", e);
    res.status(500).json({ error: "Failed to fetch cooked menus" });
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
    where.stock = { gt: 0 };
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
    mealTypes: MenuMealType.map((mt) => mt.mealType),
    starch: starchRel,
    vegetable: vegetableRel,
  }));

  res.json(result);
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
  const { name, slug, category, stock, price, mealTypes, starchId, vegetableId, images } = req.body;
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
  const { name, slug, category, stock, price, mealTypes, starchId, vegetableId, images } = req.body;

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
    const result = await prisma.$transaction(async (tx) => {
      const data: Record<string, unknown> = {
        ...(name !== undefined && { name }),
        ...(slug !== undefined && { slug }),
        ...(category !== undefined && { category }),
        ...(stock !== undefined && { stock }),
        ...(price !== undefined && { price }),
        ...(images !== undefined && { images }),
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
