import { Router } from "express";
import prisma from "../db/db.js";

const router = Router();

const HHMM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

function occurrenceOf(time: string, day: Date): Date {
  const [h, m] = time.split(":").map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0);
}

router.get("/", async (_req, res) => {
  try {
    const configs = await prisma.shiftConfig.findMany({ orderBy: [{ isActive: "desc" }, { type: "asc" }] });
    res.json(configs);
  } catch (e) {
    console.error("Error listing shift configs:", e);
    res.status(500).json({ error: "Failed to list shift configs" });
  }
});

router.post("/", async (req, res) => {
  const { type, autoOpenTime, autoCloseTime, manual, anchorIntervalMinutes } = req.body;

  if (!type || typeof type !== "string" || type.trim().length === 0) {
    return res.status(400).json({ error: "type is required and must be a non-empty string" });
  }
  if (type.length > 50) {
    return res.status(400).json({ error: "type must not exceed 50 characters" });
  }
  if (!autoOpenTime || !HHMM_REGEX.test(autoOpenTime)) {
    return res.status(400).json({ error: "autoOpenTime must match HH:MM format" });
  }
  if (!autoCloseTime || !HHMM_REGEX.test(autoCloseTime)) {
    return res.status(400).json({ error: "autoCloseTime must match HH:MM format" });
  }
  if (manual !== undefined && typeof manual !== "boolean") {
    return res.status(400).json({ error: "manual must be a boolean" });
  }
  if (anchorIntervalMinutes !== undefined && (!Number.isInteger(anchorIntervalMinutes) || anchorIntervalMinutes < 1)) {
    return res.status(400).json({ error: "anchorIntervalMinutes must be a positive integer (minutes)" });
  }

  try {
    const config = await prisma.shiftConfig.create({
      data: {
        type: type.trim(),
        autoOpenTime,
        autoCloseTime,
        isActive: true,
        manual: manual ?? false,
        anchorIntervalMinutes: anchorIntervalMinutes ?? 1440,
      },
    });
    res.status(201).json(config);
  } catch (e) {
    console.error("Error creating shift config:", e);
    res.status(500).json({ error: "Failed to create shift config" });
  }
});

router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { type, autoOpenTime, autoCloseTime, isActive, manual, anchorIntervalMinutes } = req.body;

  if (type !== undefined) {
    if (typeof type !== "string" || type.trim().length === 0) {
      return res.status(400).json({ error: "type must be a non-empty string" });
    }
    if (type.trim().length > 50) {
      return res.status(400).json({ error: "type must not exceed 50 characters" });
    }
  }
  if (autoOpenTime !== undefined && !HHMM_REGEX.test(autoOpenTime)) {
    return res.status(400).json({ error: "autoOpenTime must match HH:MM format" });
  }
  if (autoCloseTime !== undefined && !HHMM_REGEX.test(autoCloseTime)) {
    return res.status(400).json({ error: "autoCloseTime must match HH:MM format" });
  }
  if (manual !== undefined && typeof manual !== "boolean") {
    return res.status(400).json({ error: "manual must be a boolean" });
  }
  if (anchorIntervalMinutes !== undefined && (!Number.isInteger(anchorIntervalMinutes) || anchorIntervalMinutes < 1)) {
    return res.status(400).json({ error: "anchorIntervalMinutes must be a positive integer (minutes)" });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const config = await tx.shiftConfig.update({
        where: { id },
        data: {
          type: type !== undefined ? type.trim() : undefined,
          autoOpenTime,
          autoCloseTime,
          isActive,
          manual,
          anchorIntervalMinutes,
        },
      });

      // Sync timing changes to open shifts of this type only. Closed shifts
      // (isOpen=false) are historical records and are never touched.
      if (autoOpenTime !== undefined || autoCloseTime !== undefined) {
        const openShifts = await tx.shift.findMany({
          where: { type: config.type, isOpen: true },
        });

        for (const shift of openShifts) {
          const newAutoOpen = occurrenceOf(config.autoOpenTime, shift.operationDay);
          const newAutoClose = occurrenceOf(config.autoCloseTime, shift.operationDay);

          // Midnight-crossing: if close <= open the shift spans into the next day.
          if (newAutoClose.getTime() <= newAutoOpen.getTime()) {
            newAutoClose.setDate(newAutoClose.getDate() + 1);
          }

          await tx.shift.update({
            where: { id: shift.id },
            data: {
              autoOpenTime: newAutoOpen,
              autoCloseTime: newAutoClose,
            },
          });
        }
      }

      return config;
    });

    res.json(updated);
  } catch (e) {
    console.error("Error updating shift config:", e);
    res.status(500).json({ error: "Failed to update shift config" });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const count = await prisma.shiftConfig.count();
    if (count <= 1) {
      return res.status(400).json({ error: "Cannot delete the last shift config" });
    }
    await prisma.shiftConfig.delete({ where: { id } });
    res.json({ success: true });
  } catch (e) {
    console.error("Error deleting shift config:", e);
    res.status(500).json({ error: "Failed to delete shift config" });
  }
});

export default router;
