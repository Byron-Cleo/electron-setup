import { Router } from "express";
import prisma from "../db/db";

const router = Router();

// GET /api/stock-supply-categories - List all categories
router.get("/", async (_req, res) => {
  const categories = await prisma.stockSupplyCategory.findMany({
    include: { _count: { select: { StockSupply: true } } },
    orderBy: { name: "asc" },
  });
  res.json(categories);
});

// GET /api/stock-supply-categories/:id - Get single category
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const category = await prisma.stockSupplyCategory.findUnique({
    where: { id },
    include: { StockSupply: { where: { isActive: true } } },
  });
  if (!category) return res.status(404).json({ error: "Category not found" });
  res.json(category);
});

// POST /api/stock-supply-categories - Create category
router.post("/", async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  
  try {
    const category = await prisma.stockSupplyCategory.create({
      data: { name, description },
    });
    res.status(201).json(category);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(409).json({ error: "Category name already exists" });
    throw e;
  }
});

// PUT /api/stock-supply-categories/:id - Update category
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  try {
    const category = await prisma.stockSupplyCategory.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
      },
    });
    res.json(category);
  } catch (e: any) {
    if (e.code === "P2025") return res.status(404).json({ error: "Category not found" });
    if (e.code === "P2002") return res.status(409).json({ error: "Category name already exists" });
    throw e;
  }
});

// DELETE /api/stock-supply-categories/:id - Delete category
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // Check if category has items
    const itemCount = await prisma.stockSupply.count({ where: { categoryId: id } });
    if (itemCount > 0) {
      return res.status(409).json({ error: "Cannot delete category with existing items" });
    }
    await prisma.stockSupplyCategory.delete({ where: { id } });
    res.json({ message: "Deleted", id });
  } catch (e: any) {
    if (e.code === "P2025") return res.status(404).json({ error: "Category not found" });
    throw e;
  }
});

export default router;
