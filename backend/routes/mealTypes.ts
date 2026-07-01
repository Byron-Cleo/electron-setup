import { Router } from "express";
import { ServiceTime } from "../db/generated/prisma/client";

const router = Router();

const MEAL_TYPE_ORDER: Record<string, number> = {
  BREAKFAST: 1,
  LUNCH: 2,
  DINNER: 3,
  DESSERT: 4,
  BEVERAGE: 5,
};

router.get("/", async (_req, res) => {
  const types = Object.values(ServiceTime).map((name) => ({
    id: name,
    name,
    sortOrder: MEAL_TYPE_ORDER[name] ?? 99,
  }));
  res.json(types);
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const names = Object.values(ServiceTime) as string[];
  if (!names.includes(id)) return res.status(404).json({ error: "Not found" });
  res.json({ id, name: id, sortOrder: MEAL_TYPE_ORDER[id] ?? 99 });
});

router.post("/", async (_req, res) => {
  res.status(405).json({ error: "Meal types are fixed enums and cannot be created" });
});

router.put("/:id", async (_req, res) => {
  res.status(405).json({ error: "Meal types are fixed enums and cannot be updated" });
});

router.delete("/:id", async (_req, res) => {
  res.status(405).json({ error: "Meal types are fixed enums and cannot be deleted" });
});

export default router;
