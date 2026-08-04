import { Router } from "express"
import prisma from "../db/db.js"
import { AccompanimentType } from "../db/generated/prisma/client.js"

const router = Router()

const VALID_CATEGORIES = Object.values(AccompanimentType) as string[];

router.get("/", async (_req, res) => {
  const items = await prisma.menuAccompaniment.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
  })
  res.json(items)
})

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const item = await prisma.menuAccompaniment.findUnique({ where: { id } });
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json(item);
});

router.post("/", async (req, res) => {
  const { name, category, description, price, image, isDefault } = req.body;
  if (!name || !category) {
    return res.status(400).json({ error: "name and category are required" });
  }
  if (!VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `Invalid category: ${category}. Must be one of: ${VALID_CATEGORIES.join(", ")}` });
  }

  const item = await prisma.menuAccompaniment.create({
    data: {
      name,
      category,
      image: image ?? "",
      ...(description !== undefined && { description }),
      ...(price !== undefined && { price }),
      ...(isDefault !== undefined && { isDefault }),
    },
  });
  res.status(201).json(item);
});

router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, category, description, price, image, isDefault } = req.body;
  if (category !== undefined && !VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `Invalid category: ${category}. Must be one of: ${VALID_CATEGORIES.join(", ")}` });
  }

  try {
    const item = await prisma.menuAccompaniment.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(category !== undefined && { category }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price }),
        ...(image !== undefined && { image }),
        ...(isDefault !== undefined && { isDefault }),
      },
    });
    res.json(item);
  } catch (e) {
    if (isNotFoundError(e)) return res.status(404).json({ error: "Not found" });
    throw e;
  }
});

function isNotFoundError(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2025"
}

export default router
