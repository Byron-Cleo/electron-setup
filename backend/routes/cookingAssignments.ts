import { Router } from "express";
import prisma from "../db/db";

const router = Router();

// GET /api/cooking-assignments/available?date=YYYY-MM-DD
// Returns available plates per cooking record for a given date
router.get("/available", async (req, res) => {
  const { date } = req.query;

  const where: Record<string, unknown> = {};
  if (date) {
    const d = new Date(date as string);
    if (isNaN(d.getTime())) {
      return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
    }
    where.cookedDate = d;
  }

  const records = await prisma.cookingRecord.findMany({
    where,
    include: {
      stockSupply: { select: { id: true, name: true, unit: true, platesPerUnit: true } },
      cookedBy: { select: { id: true, name: true } },
      assignments: {
        include: {
          menu: { select: { id: true, name: true, slug: true, images: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Calculate available plates for each record
  const result = records.map((record) => {
    const platesActual = Number(record.platesActual ?? record.platesExpected);
    const totalAssigned = record.assignments.reduce(
      (sum, a) => sum + Number(a.quantityPlates),
      0
    );
    const availablePlates = platesActual - totalAssigned;

    return {
      ...record,
      availablePlates: Math.max(0, availablePlates),
    };
  });

  res.json(result);
});

// POST /api/cooking-assignments - Assign plates to a menu variant
router.post("/", async (req, res) => {
  const { cookingRecordId, menuId, quantityPlates } = req.body;

  if (!cookingRecordId || !menuId || !quantityPlates) {
    return res.status(400).json({ error: "cookingRecordId, menuId, and quantityPlates are required" });
  }

  if (Number(quantityPlates) <= 0) {
    return res.status(400).json({ error: "quantityPlates must be greater than 0" });
  }

  // Verify cooking record exists
  const cookingRecord = await prisma.cookingRecord.findUnique({
    where: { id: cookingRecordId },
    include: { assignments: true },
  });
  if (!cookingRecord) return res.status(404).json({ error: "Cooking record not found" });

  // Verify menu exists
  const menu = await prisma.menu.findUnique({ where: { id: menuId } });
  if (!menu) return res.status(404).json({ error: "Menu not found" });

  // Check available plates
  const platesActual = Number(cookingRecord.platesActual ?? cookingRecord.platesExpected);
  const totalAssigned = cookingRecord.assignments.reduce(
    (sum, a) => sum + Number(a.quantityPlates),
    0
  );
  const availablePlates = platesActual - totalAssigned;

  if (Number(quantityPlates) > availablePlates) {
    return res.status(400).json({
      error: `Cannot assign ${quantityPlates} plates. Only ${availablePlates} available.`,
    });
  }

  // Check if assignment already exists for this cooking record + menu combo
  const existing = await prisma.cookingRecordAssignment.findUnique({
    where: { cookingRecordId_menuId: { cookingRecordId, menuId } },
  });
  if (existing) {
    return res.status(400).json({ error: "Assignment already exists for this cooking record and menu. Use PUT to update." });
  }

  const assignment = await prisma.cookingRecordAssignment.create({
    data: {
      cookingRecordId,
      menuId,
      quantityPlates: Number(quantityPlates),
    },
    include: {
      cookingRecord: {
        include: {
          stockSupply: { select: { id: true, name: true, unit: true, platesPerUnit: true } },
          cookedBy: { select: { id: true, name: true } },
          assignments: {
            include: {
              menu: { select: { id: true, name: true, slug: true, images: true } },
            },
          },
        },
      },
      menu: { select: { id: true, name: true, slug: true, images: true } },
    },
  });

  res.status(201).json(assignment);
});

// PUT /api/cooking-assignments/:id - Update assignment quantity
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { quantityPlates } = req.body;

  if (!quantityPlates) {
    return res.status(400).json({ error: "quantityPlates is required" });
  }

  if (Number(quantityPlates) <= 0) {
    return res.status(400).json({ error: "quantityPlates must be greater than 0" });
  }

  const existing = await prisma.cookingRecordAssignment.findUnique({
    where: { id },
    include: { cookingRecord: { include: { assignments: true } } },
  });
  if (!existing) return res.status(404).json({ error: "Assignment not found" });

  // Calculate available plates (excluding this assignment)
  const cookingRecord = existing.cookingRecord;
  const platesActual = Number(cookingRecord.platesActual ?? cookingRecord.platesExpected);
  const otherAssigned = cookingRecord.assignments
    .filter((a) => a.id !== id)
    .reduce((sum, a) => sum + Number(a.quantityPlates), 0);
  const availablePlates = platesActual - otherAssigned;

  if (Number(quantityPlates) > availablePlates) {
    return res.status(400).json({
      error: `Cannot assign ${quantityPlates} plates. Only ${availablePlates} available.`,
    });
  }

  const assignment = await prisma.cookingRecordAssignment.update({
    where: { id },
    data: { quantityPlates: Number(quantityPlates) },
    include: {
      cookingRecord: {
        include: {
          stockSupply: { select: { id: true, name: true, unit: true, platesPerUnit: true } },
          cookedBy: { select: { id: true, name: true } },
          assignments: {
            include: {
              menu: { select: { id: true, name: true, slug: true, images: true } },
            },
          },
        },
      },
      menu: { select: { id: true, name: true, slug: true, images: true } },
    },
  });

  res.json(assignment);
});

// DELETE /api/cooking-assignments/:id - Remove assignment
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  const existing = await prisma.cookingRecordAssignment.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Assignment not found" });

  await prisma.cookingRecordAssignment.delete({ where: { id } });

  res.json({ message: "Assignment deleted" });
});

export default router;
