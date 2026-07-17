import { Router } from "express";
import prisma from "../db/db";

const router = Router();

// GET /api/kitchen-config - List all stock supplies with kitchen config
router.get("/", async (_req, res) => {
  const items = await prisma.stockSupply.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      unit: true,
      image: true,
      currentStock: true,
      reorderLevel: true,
      platesPerUnit: true,
      menuId: true,
      menu: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
  });
  res.json(items);
});

// PUT /api/kitchen-config/:id - Update kitchen config for a stock supply
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { platesPerUnit, menuId } = req.body;

  const stockSupply = await prisma.stockSupply.findUnique({ where: { id } });
  if (!stockSupply) return res.status(404).json({ error: "Stock supply not found" });

  if (menuId) {
    const menu = await prisma.menu.findUnique({ where: { id: menuId } });
    if (!menu) return res.status(400).json({ error: "Menu item not found" });
  }

  try {
    const updated = await prisma.stockSupply.update({
      where: { id },
      data: {
        ...(platesPerUnit !== undefined && { platesPerUnit }),
        ...(menuId !== undefined && { menuId: menuId || null }),
      },
      select: {
        id: true,
        name: true,
        unit: true,
        platesPerUnit: true,
        menuId: true,
        menu: { select: { id: true, name: true } },
      },
    });
    res.json(updated);
  } catch (e: any) {
    if (e.code === "P2025") return res.status(404).json({ error: "Stock supply not found" });
    throw e;
  }
});

export default router;
