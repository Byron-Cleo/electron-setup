import { Router } from "express";
import prisma from "../db/db.js";

const router = Router();

function parseDisplayOrder(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

async function nextDisplayOrder(): Promise<number> {
  const last = await prisma.category.findFirst({
    orderBy: { displayOrder: "desc" },
    select: { displayOrder: true },
  });
  return (last?.displayOrder ?? 0) + 1;
}

// GET /api/categories - List all categories (display order, then name)
router.get("/", async (_req, res) => {
  const categories = await prisma.category.findMany({
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  });
  res.json(categories);
});

// POST /api/categories - Create category
router.post("/", async (req, res) => {
  const { name, displayOrder } = req.body;

  if (!name) return res.status(400).json({ error: "name is required" });

  try {
    const explicit = parseDisplayOrder(displayOrder);

    if (explicit !== null) {
      const clash = await prisma.category.findFirst({
        where: { displayOrder: explicit },
        select: { id: true },
      });
      if (clash) return res.status(409).json({ error: "Display order already in use" });
    }

    const category = await prisma.category.create({
      data: {
        name: name.trim(),
        displayOrder: explicit ?? (await nextDisplayOrder()),
      },
    });
    res.status(201).json(category);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === "P2002") return res.status(409).json({ error: "Category name already exists" });
    throw e;
  }
});

// PUT /api/categories/:id - Update category
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, displayOrder } = req.body;

  try {
    const data: { name?: string; displayOrder?: number } = {};
    if (name !== undefined) data.name = name.trim();

    if (displayOrder !== undefined) {
      const explicit = parseDisplayOrder(displayOrder);
      if (explicit === null) {
        return res.status(400).json({ error: "displayOrder must be a positive integer" });
      }
      const clash = await prisma.category.findFirst({
        where: { displayOrder: explicit, id: { not: id } },
        select: { id: true },
      });
      if (clash) return res.status(409).json({ error: "Display order already in use" });
      data.displayOrder = explicit;
    }

    const category = await prisma.category.update({ where: { id }, data });
    res.json(category);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === "P2025") return res.status(404).json({ error: "Category not found" });
    if (err.code === "P2002") return res.status(409).json({ error: "Category name already exists" });
    throw e;
  }
});

// DELETE /api/categories/:id - Delete category
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.category.delete({ where: { id } });
    res.json({ message: "Category deleted" });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === "P2025") return res.status(404).json({ error: "Category not found" });
    throw e;
  }
});

export default router;
