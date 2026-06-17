import { Router } from "express";
import prisma from "../db.ts";

const router = Router();

router.get("/", async (_req, res) => {
  const types = await prisma.mealType.findMany({ orderBy: { sortOrder: "asc" } });
  res.json(types);
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const type = await prisma.mealType.findUnique({ where: { id } });
  if (!type) return res.status(404).json({ error: "Not found" });
  res.json(type);
});

router.post("/", async (req, res) => {
  const { name, sortOrder } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  const type = await prisma.mealType.create({
    data: { name, sortOrder: sortOrder ?? 0 },
  });
  res.status(201).json(type);
});

router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, sortOrder } = req.body;
  try {
    const type = await prisma.mealType.update({
      where: { id },
      data: { ...(name !== undefined && { name }), ...(sortOrder !== undefined && { sortOrder }) },
    });
    res.json(type);
  } catch (e: any) {
    if (e.code === "P2025") return res.status(404).json({ error: "Not found" });
    throw e;
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.mealType.delete({ where: { id } });
    res.json({ message: "Deleted", id });
  } catch (e: any) {
    if (e.code === "P2025") return res.status(404).json({ error: "Not found" });
    throw e;
  }
});

export default router;
