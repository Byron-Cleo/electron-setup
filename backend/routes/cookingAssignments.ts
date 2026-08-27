import { Router } from "express";
import prisma from "../db/db.js";

const router = Router();

// GET /api/cooking-assignments/carry-over - Cooked plates carry over (unsold)
router.get("/carry-over", async (_req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get all cooking records before today with assignments
  const records = await prisma.cookingRecord.findMany({
    where: { cookedDate: { lt: today } },
    include: {
      stockSupply: { select: { id: true, name: true } },
      assignments: {
        include: {
          menu: { select: { id: true, name: true } },
        },
      },
    },
  });

  // Aggregate by menu variant: produced vs sold
  const carryOverMap = new Map<string, { name: string; produced: number; sold: number }>();

  for (const record of records) {
    const plates = Number(record.platesActual ?? record.platesExpected);
    const totalAssigned = record.assignments.reduce(
      (sum, a) => sum + Number(a.quantityPlates),
      0
    );

    // Add proportional plates produced per menu variant
    if (totalAssigned > 0) {
      for (const assignment of record.assignments) {
        const menuId = assignment.menuId;
        const proportion = Number(assignment.quantityPlates) / totalAssigned;
        const platesForVariant = plates * proportion;
        const qtyAssigned = Number(assignment.quantityPlates);

        const existing = carryOverMap.get(menuId);
        if (existing) {
          existing.produced += platesForVariant;
          existing.sold += qtyAssigned;
        } else {
          carryOverMap.set(menuId, {
            name: assignment.menu.name,
            produced: platesForVariant,
            sold: qtyAssigned,
          });
        }
      }
    }
  }

  const carryOver = Array.from(carryOverMap.values())
    .map((data) => ({
      name: data.name,
      plates: Math.round(data.produced) - data.sold,
    }))
    .filter((item) => item.plates > 0);

  res.json(carryOver);
});

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
    const nextDay = new Date(d);
    nextDay.setDate(nextDay.getDate() + 1);
    where.cookedDate = { gte: d, lt: nextDay };
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
  const { cookingRecordId, stockSupplyId, date, menuId, quantityPlates } = req.body;

  if (!menuId || !quantityPlates) {
    return res.status(400).json({ error: "menuId and quantityPlates are required" });
  }

  if (!cookingRecordId && !stockSupplyId) {
    return res.status(400).json({ error: "cookingRecordId or stockSupplyId is required" });
  }

  if (Number(quantityPlates) <= 0) {
    return res.status(400).json({ error: "quantityPlates must be greater than 0" });
  }

  // Verify menu exists
  const menu = await prisma.menu.findUnique({ where: { id: menuId } });
  if (!menu) return res.status(404).json({ error: "Menu not found" });

  // Resolve cooking record
  let cookingRecord;
  if (cookingRecordId) {
    cookingRecord = await prisma.cookingRecord.findUnique({
      where: { id: cookingRecordId },
      include: { assignments: true },
    });
  } else {
    // Find cooking record by stockSupplyId and date (latest first)
    const where: Record<string, unknown> = { stockSupplyId };
    if (date) {
      where.cookedDate = new Date(date);
    }
    cookingRecord = await prisma.cookingRecord.findFirst({
      where,
      include: { assignments: true },
      orderBy: { createdAt: "desc" },
    });
  }

  if (!cookingRecord) return res.status(404).json({ error: "Cooking record not found" });

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
    where: { cookingRecordId_menuId: { cookingRecordId: cookingRecord.id, menuId } },
  });

  const assignment = await prisma.$transaction(async (tx) => {
    let assignment;
    if (existing) {
      // Additive: add new quantity to existing quantity
      const updatedQty = Number(existing.quantityPlates) + Number(quantityPlates);
      assignment = await tx.cookingRecordAssignment.update({
        where: { id: existing.id },
        data: { quantityPlates: updatedQty },
      });
    } else {
      // Create new assignment
      assignment = await tx.cookingRecordAssignment.create({
        data: {
          cookingRecordId: cookingRecord.id,
          menuId,
          quantityPlates: Number(quantityPlates),
        },
      });
    }

    // Increment menu stock — assignment adds plates to the menu
    await tx.menu.update({
      where: { id: menuId },
      data: { stock: { increment: Number(quantityPlates) } },
    });

    return tx.cookingRecordAssignment.findUnique({
      where: { id: assignment.id },
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
  });

  res.status(existing ? 200 : 201).json(assignment);
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

  const oldQty = Number(existing.quantityPlates);
  const newQty = Number(quantityPlates);
  const delta = newQty - oldQty;

  const assignment = await prisma.$transaction(async (tx) => {
    const updated = await tx.cookingRecordAssignment.update({
      where: { id },
      data: { quantityPlates: newQty },
    });

    if (delta !== 0) {
      await tx.menu.update({
        where: { id: existing.menuId },
        data: delta > 0 ? { stock: { increment: delta } } : { stock: { decrement: Math.abs(delta) } },
      });
    }

    return tx.cookingRecordAssignment.findUnique({
      where: { id: updated.id },
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
  });

  res.json(assignment);
});

// POST /api/cooking-assignments/upsert - Create or update assignment for a cooking record + menu
router.post("/upsert", async (req, res) => {
  const { cookingRecordId, menuId, quantityPlates } = req.body;

  if (!cookingRecordId || !menuId || quantityPlates === undefined) {
    return res.status(400).json({ error: "cookingRecordId, menuId, and quantityPlates are required" });
  }

  if (Number(quantityPlates) <= 0) {
    return res.status(400).json({ error: "quantityPlates must be greater than 0" });
  }

  const cookingRecord = await prisma.cookingRecord.findUnique({
    where: { id: cookingRecordId },
    include: { assignments: true },
  });
  if (!cookingRecord) return res.status(404).json({ error: "Cooking record not found" });

  const menu = await prisma.menu.findUnique({ where: { id: menuId } });
  if (!menu) return res.status(404).json({ error: "Menu not found" });

  const existing = cookingRecord.assignments.find((a) => a.menuId === menuId);
  const oldQty = existing ? Number(existing.quantityPlates) : 0;
  const newQty = Number(quantityPlates);
  const delta = newQty - oldQty;

  // Available = total produced - (total assigned excluding this menu's current assignment)
  const otherAssigned = cookingRecord.assignments
    .filter((a) => a.menuId !== menuId)
    .reduce((sum, a) => sum + Number(a.quantityPlates), 0);
  const platesActual = Number(cookingRecord.platesActual ?? cookingRecord.platesExpected);
  const available = platesActual - otherAssigned;

  if (newQty > available) {
    return res.status(400).json({
      error: `Cannot assign ${newQty} plates. Only ${available} available.`,
    });
  }

  const result = await prisma.$transaction(async (tx) => {
    let assignment;
    if (existing) {
      assignment = await tx.cookingRecordAssignment.update({
        where: { id: existing.id },
        data: { quantityPlates: newQty },
      });
    } else {
      assignment = await tx.cookingRecordAssignment.create({
        data: { cookingRecordId, menuId, quantityPlates: newQty },
      });
    }

    if (delta !== 0) {
      await tx.menu.update({
        where: { id: menuId },
        data: delta > 0
          ? { stock: { increment: delta } }
          : { stock: { decrement: Math.abs(delta) } },
      });
    }

    return assignment;
  });

  res.status(existing ? 200 : 201).json(result);
});

// DELETE /api/cooking-assignments/:id - Remove assignment
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  const existing = await prisma.cookingRecordAssignment.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Assignment not found" });

  await prisma.$transaction(async (tx) => {
    await tx.cookingRecordAssignment.delete({ where: { id } });

    await tx.menu.update({
      where: { id: existing.menuId },
      data: { stock: { decrement: Number(existing.quantityPlates) } },
    });
  });

  res.json({ message: "Assignment deleted" });
});

export default router;
