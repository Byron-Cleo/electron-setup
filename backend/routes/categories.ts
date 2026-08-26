import { Router } from "express";
import prisma from "../db/db.js";

const router = Router();

// GET /api/categories - List all categories
router.get("/", async (_req, res) => {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
  });
  res.json(categories);
});

// POST /api/categories - Create category
router.post("/", async (req, res) => {
  const { name } = req.body;

  if (!name) return res.status(400).json({ error: "name is required" });

  try {
    const category = await prisma.category.create({
      data: { name: name.trim() },
    });
    res.status(201).json(category);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(409).json({ error: "Category name already exists" });
    throw e;
  }
});

// PUT /api/categories/:id - Update category
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  try {
    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
      },
    });
    res.json(category);
  } catch (e: any) {
    if (e.code === "P2025") return res.status(404).json({ error: "Category not found" });
    if (e.code === "P2002") return res.status(409).json({ error: "Category name already exists" });
    throw e;
  }
});

// DELETE /api/categories/:id - Delete category
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.category.delete({ where: { id } });
    res.json({ message: "Category deleted" });
  } catch (e: any) {
    if (e.code === "P2025") return res.status(404).json({ error: "Category not found" });
    throw e;
  }
});

export default router;
