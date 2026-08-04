import { Router } from "express";
import prisma from "../db/db.js";

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
      isMenuStock: true,
      platesPerUnit: true,
      menus: {
        select: { menu: { select: { id: true, name: true } } },
      },
    },
    orderBy: { name: "asc" },
  });
  const flattened = items.map(({ menus, ...rest }) => ({
    ...rest,
    menus: menus.map((m) => m.menu),
  }));
  res.json(flattened);
});

// PUT /api/kitchen-config/:id - Update plates per unit for a stock supply
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { platesPerUnit } = req.body;

  const stockSupply = await prisma.stockSupply.findUnique({ where: { id } });
  if (!stockSupply) return res.status(404).json({ error: "Stock supply not found" });

  try {
    const updated = await prisma.stockSupply.update({
      where: { id },
      data: {
        ...(platesPerUnit !== undefined && { platesPerUnit }),
      },
      select: {
        id: true,
        name: true,
        unit: true,
        isMenuStock: true,
        platesPerUnit: true,
        menus: {
          select: { menu: { select: { id: true, name: true } } },
        },
      },
    });
    res.json({ ...updated, menus: updated.menus.map((m) => m.menu) });
  } catch (e: any) {
    if (e.code === "P2025") return res.status(404).json({ error: "Stock supply not found" });
    throw e;
  }
});

export default router;
