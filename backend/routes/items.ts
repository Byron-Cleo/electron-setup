import { Router } from "express";
import prisma from "../db/db";
import { ItemUnit } from "../db/generated/prisma/client";

const router = Router();

const VALID_UNITS = Object.values(ItemUnit) as string[];

// GET /api/items - List all items
router.get("/", async (_req, res) => {
  const items = await prisma.item.findMany({
    where: { isActive: true },
    include: { category: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });
  res.json(items);
});

// GET /api/items/:id - Get single item
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const item = await prisma.item.findUnique({
    where: { id },
    include: { category: true },
  });
  if (!item) return res.status(404).json({ error: "Item not found" });
  res.json(item);
});

// POST /api/items - Create item
router.post("/", async (req, res) => {
  const { name, slug, description, unit, categoryId, currentStock, reorderLevel } = req.body;
  
  if (!name || !unit || !categoryId) {
    return res.status(400).json({ error: "name, unit, categoryId are required" });
  }
  
  if (!VALID_UNITS.includes(unit)) {
    return res.status(400).json({ error: `Invalid unit: ${unit}. Must be one of: ${VALID_UNITS.join(", ")}` });
  }
  
  // Verify category exists
  const category = await prisma.itemCategory.findUnique({ where: { id: categoryId } });
  if (!category) return res.status(400).json({ error: "Category not found" });
  
  const generatedSlug = slug || name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  
  try {
    const item = await prisma.item.create({
      data: {
        name,
        slug: generatedSlug,
        description,
        unit,
        categoryId,
        currentStock: currentStock ?? 0,
        reorderLevel,
      },
      include: { category: true },
    });
    res.status(201).json(item);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(409).json({ error: "Item slug already exists" });
    throw e;
  }
});

// PUT /api/items/:id - Update item
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, slug, description, unit, categoryId, currentStock, reorderLevel, isActive } = req.body;
  
  if (unit && !VALID_UNITS.includes(unit)) {
    return res.status(400).json({ error: `Invalid unit: ${unit}. Must be one of: ${VALID_UNITS.join(", ")}` });
  }
  
  if (categoryId) {
    const category = await prisma.itemCategory.findUnique({ where: { id: categoryId } });
    if (!category) return res.status(400).json({ error: "Category not found" });
  }
  
  try {
    const item = await prisma.item.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(slug !== undefined && { slug }),
        ...(description !== undefined && { description }),
        ...(unit !== undefined && { unit }),
        ...(categoryId !== undefined && { categoryId }),
        ...(currentStock !== undefined && { currentStock }),
        ...(reorderLevel !== undefined && { reorderLevel }),
        ...(isActive !== undefined && { isActive }),
      },
      include: { category: true },
    });
    res.json(item);
  } catch (e: any) {
    if (e.code === "P2025") return res.status(404).json({ error: "Item not found" });
    if (e.code === "P2002") return res.status(409).json({ error: "Item slug already exists" });
    throw e;
  }
});

// DELETE /api/items/:id - Soft delete (set isActive = false)
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const item = await prisma.item.update({
      where: { id },
      data: { isActive: false },
    });
    res.json({ message: "Item deactivated", id: item.id });
  } catch (e: any) {
    if (e.code === "P2025") return res.status(404).json({ error: "Item not found" });
    throw e;
  }
});

export default router;