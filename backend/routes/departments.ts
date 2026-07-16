import { Router } from "express";
import prisma from "../db/db";

const router = Router();

// GET /api/departments - List all departments
router.get("/", async (_req, res) => {
  const departments = await prisma.department.findMany({
    include: {
      DepartmentStockSupply: {
        include: {
          stockSupply: { select: { id: true, name: true, unit: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });
  res.json(departments);
});

// GET /api/departments/:id - Get single department
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const department = await prisma.department.findUnique({
    where: { id },
    include: {
      DepartmentStockSupply: {
        include: {
          stockSupply: { select: { id: true, name: true, unit: true, currentStock: true } },
        },
      },
    },
  });
  if (!department) return res.status(404).json({ error: "Department not found" });
  res.json(department);
});

// POST /api/departments - Create department
router.post("/", async (req, res) => {
  const { name, description } = req.body;

  if (!name) return res.status(400).json({ error: "name is required" });

  try {
    const department = await prisma.department.create({
      data: { name, description },
    });
    res.status(201).json(department);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(409).json({ error: "Department name already exists" });
    throw e;
  }
});

// PUT /api/departments/:id - Update department
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;

  try {
    const department = await prisma.department.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
      },
    });
    res.json(department);
  } catch (e: any) {
    if (e.code === "P2025") return res.status(404).json({ error: "Department not found" });
    if (e.code === "P2002") return res.status(409).json({ error: "Department name already exists" });
    throw e;
  }
});

// DELETE /api/departments/:id - Delete department
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.department.delete({ where: { id } });
    res.json({ message: "Department deleted" });
  } catch (e: any) {
    if (e.code === "P2025") return res.status(404).json({ error: "Department not found" });
    throw e;
  }
});

export default router;
