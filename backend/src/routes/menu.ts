import { Router } from "express";
import prisma from "../db.ts";

const router = Router();

router.get("/", async (_req, res) => {
  const items = await prisma.menu.findMany({ orderBy: { createdAt: "desc" } });
  res.json(items);
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
