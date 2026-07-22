import { Router } from "express";
import prisma from "../db/db";
import { ServiceTime } from "../db/generated/prisma/client";

const router = Router();

const VALID_MEAL_TYPES = Object.values(ServiceTime) as string[];

router.get("/cooked", async (_req, res) => {
  try {
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
            stockSupply: { select: { id: true, name: true, unit: true, platesPerUnit: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = await Promise.all(
      menus.map(async (menu) => {
        const stockSupplyIds = menu.stockSupplyMenus.map((sm) => sm.stockSupply.id);

        const cookingRecords = await prisma.cookingRecord.findMany({
          where: { stockSupplyId: { in: stockSupplyIds } },
          include: {
            assignments: { select: { quantityPlates: true } },
          },
        });

        let totalProduced = 0;
        let totalAssigned = 0;

        for (const record of cookingRecords) {
          const produced = Number(record.platesActual ?? record.platesExpected);
          const assigned = record.assignments.reduce(
            (sum, a) => sum + Number(a.quantityPlates),
            0
          );
          totalProduced += produced;
          totalAssigned += assigned;
        }

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
  const item = await prisma.menu.findUnique({ where: { id } });
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json(item);
});

router.post("/", async (req, res) => {
  const { name, slug, category, brand, description, stock, price, isFeatured } = req.body;
  if (!name || !category || !brand || !description) {
    return res.status(400).json({ error: "name, category, brand, description are required" });
  }
  const item = await prisma.menu.create({
    data: {
      name,
      slug: slug || name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
      category,
      brand,
      description,
      stock: stock ?? 0,
      price: price ?? 0,
      isFeatured: isFeatured ?? false,
    },
  });
  res.status(201).json(item);
});

router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, slug, category, brand, description, stock, price, isFeatured } = req.body;
  try {
    const item = await prisma.menu.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(slug !== undefined && { slug }),
        ...(category !== undefined && { category }),
        ...(brand !== undefined && { brand }),
        ...(description !== undefined && { description }),
        ...(stock !== undefined && { stock }),
        ...(price !== undefined && { price }),
        ...(isFeatured !== undefined && { isFeatured }),
      },
    });
    res.json(item);
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
