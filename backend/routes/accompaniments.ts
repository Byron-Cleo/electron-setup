import { Router } from "express"
import prisma from "../db/db.js"
import { AccompanimentType } from "../db/generated/prisma/client.js"
import multer from "multer"
import path from "path"
import crypto from "crypto"
import { uploadsDir } from "../db/uploads.js"
import fs from "fs/promises"

const router = Router()

const VALID_CATEGORIES = Object.values(AccompanimentType) as string[]

const accompanimentImageStorage = multer.diskStorage({
  destination: uploadsDir("menu-accompaniments"),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `${crypto.randomUUID()}${ext}`)
  },
})

const uploadAccompanimentImage = multer({
  storage: accompanimentImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"]
    cb(null, allowed.includes(file.mimetype))
  },
})

router.get("/images", async (_req, res) => {
  try {
    const dir = uploadsDir("menu-accompaniments")
    const files = await fs.readdir(dir)
    const images = files
      .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
      .sort()
      .map((f) => `/uploads/menu-accompaniments/${f}`)
    res.json({ images })
  } catch {
    res.status(500).json({ error: "Failed to list accompaniment images" })
  }
})

router.post("/upload", uploadAccompanimentImage.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image file uploaded (jpeg/png/webp, max 5MB)" })
  }
  res.status(201).json({ url: `/uploads/menu-accompaniments/${req.file.filename}` })
});

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
