import { Router } from "express"
import prisma from "../db/db.js"
import { AccompanimentType } from "../db/generated/prisma/client.js"
import multer from "multer"
import path from "path"
import crypto from "crypto"
import { uploadsDir } from "../db/uploads.js"
import fs from "fs/promises"
import { round2, sellableForMenu } from "../pools.js"

const router = Router()

const VALID_CATEGORIES = Object.values(AccompanimentType) as string[]

/**
 * Resolve the plates still sellable from each accompaniment's linked dish, so
 * the admin table and the waiter dialog can show `N left` / `Sold Out`.
 * Unlinked sides (and PORTION rows) report `null` — always available.
 */
async function withAvailability<
  T extends { linkedMenuId?: string | null },
>(items: T[]): Promise<(T & { availablePlates: number | null })[]> {
  const plates = new Map<string, number>()
  await Promise.all(
    items
      .filter((i) => i.linkedMenuId)
      .map(async (i) => {
        plates.set(i.linkedMenuId!, round2(await sellableForMenu(prisma, i.linkedMenuId!)))
      }),
  )
  return items.map((i) => ({
    ...i,
    availablePlates: i.linkedMenuId ? (plates.get(i.linkedMenuId) ?? null) : null,
  }))
}

/**
 * Validate an incoming `linkedMenuId` against a real Menu. Returns the id to
 * store, or `null` to clear. Throws a `400`-worthy message via `undefined`
 * sentinel-free explicit error.
 */
async function resolveLinkedMenuId(
  linkedMenuId: unknown,
): Promise<{ ok: true; value: string | null } | { ok: false; error: string }> {
  if (linkedMenuId === undefined || linkedMenuId === null || linkedMenuId === "") {
    return { ok: true, value: null }
  }
  if (typeof linkedMenuId !== "string") {
    return { ok: false, error: "linkedMenuId must be a menu id or null" }
  }
  const menu = await prisma.menu.findUnique({ where: { id: linkedMenuId }, select: { id: true } })
  if (!menu) return { ok: false, error: "linkedMenuId does not reference an existing menu" }
  return { ok: true, value: linkedMenuId }
}

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
  // PORTION rows are dish-owned (they carry menuId) and edited from MenuForm,
  // so they stay out of the global list: otherwise this endpoint would offer a
  // second, conflicting way to edit a dish's portion options.
  const items = await prisma.menuAccompaniment.findMany({
    where: { category: { not: "PORTION" } },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  })
  res.json(await withAvailability(items))
})

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const item = await prisma.menuAccompaniment.findUnique({ where: { id } });
  if (!item) return res.status(404).json({ error: "Not found" });
  const [withStock] = await withAvailability([item]);
  res.json(withStock);
});

router.post("/", async (req, res) => {
  const { name, category, description, price, image, isDefault, linkedMenuId } = req.body;
  if (!name || !category) {
    return res.status(400).json({ error: "name and category are required" });
  }
  if (!VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `Invalid category: ${category}. Must be one of: ${VALID_CATEGORIES.join(", ")}` });
  }

  const linked = await resolveLinkedMenuId(linkedMenuId);
  if (!linked.ok) return res.status(400).json({ error: linked.error });

  const item = await prisma.menuAccompaniment.create({
    data: {
      name,
      category,
      image: image ?? "",
      ...(description !== undefined && { description }),
      ...(price !== undefined && { price }),
      ...(isDefault !== undefined && { isDefault }),
      linkedMenuId: linked.value,
    },
  });
  res.status(201).json(item);
});

router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, category, description, price, image, isDefault, linkedMenuId } = req.body;
  if (category !== undefined && !VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `Invalid category: ${category}. Must be one of: ${VALID_CATEGORIES.join(", ")}` });
  }
  // Portions belong to a dish and are written through PUT /menu/:id, which
  // keeps Menu.portionId in step. Editing one here would split the two.
  if (category === "PORTION") {
    return res.status(400).json({ error: "Portions are edited from the dish, not here" });
  }

  let linkedValue: string | null | undefined;
  if (linkedMenuId !== undefined) {
    const linked = await resolveLinkedMenuId(linkedMenuId);
    if (!linked.ok) return res.status(400).json({ error: linked.error });
    linkedValue = linked.value;
  }

  try {
    const owned = await prisma.menuAccompaniment.findUnique({
      where: { id },
      select: { category: true },
    });
    if (owned?.category === "PORTION") {
      return res.status(400).json({ error: "Portions are edited from the dish, not here" });
    }

    const item = await prisma.menuAccompaniment.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(category !== undefined && { category }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price }),
        ...(image !== undefined && { image }),
        ...(isDefault !== undefined && { isDefault }),
        ...(linkedValue !== undefined && { linkedMenuId: linkedValue }),
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
