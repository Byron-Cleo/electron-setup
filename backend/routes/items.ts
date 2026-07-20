import { Router } from "express";
import prisma from "../db/db";
import { ItemUnit } from "../db/generated/prisma/client";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const router = Router();

const VALID_UNITS = Object.values(ItemUnit) as string[];

const storage = multer.diskStorage({
  destination: path.resolve(__dirname, "../uploads/stock-supplies"),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    cb(null, allowed.includes(file.mimetype));
  },
});

function deleteImageFile(imagePath: string | null) {
  if (!imagePath) return;
  const fullPath = path.resolve(__dirname, "..", imagePath);
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
}

function serializeStockSupply(item: any) {
  return {
    ...item,
    currentStock: Number(item.currentStock),
    reorderLevel: item.reorderLevel != null ? Number(item.reorderLevel) : null,
    platesPerUnit: item.platesPerUnit != null ? Number(item.platesPerUnit) : null,
  };
}

// GET /api/stock-supplies/low-stock-count - Count of items at or below reorder level
router.get("/low-stock-count", async (_req, res) => {
  const items = await prisma.stockSupply.findMany({
    where: {
      isActive: true,
      reorderLevel: { not: null },
    },
    select: { id: true, currentStock: true, reorderLevel: true },
  });

  const lowStockCount = items.filter(
    (item) => Number(item.currentStock) <= Number(item.reorderLevel!)
  ).length;

  res.json({ count: lowStockCount });
});

// GET /api/stock-supplies - List all items (optional ?departmentId filter)
router.get("/", async (req, res) => {
  const { departmentId } = req.query;

  if (departmentId) {
    // Filter by department: only items linked to the department
    const items = await prisma.stockSupply.findMany({
      where: {
        isActive: true,
        DepartmentStockSupply: { some: { departmentId: departmentId as string } },
      },
      include: { },
      orderBy: { name: "asc" },
    });
      return res.json(items.map(serializeStockSupply));
  }

  const items = await prisma.stockSupply.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
  res.json(items.map(serializeStockSupply));
});

// GET /api/stock-supplies/:id/kitchen-inventory - Kitchen inventory for specific item
router.get("/:id/kitchen-inventory", async (req, res) => {
  const { id } = req.params;

  const stockSupply = await prisma.stockSupply.findUnique({
    where: { id },
    select: { id: true, name: true, unit: true, platesPerUnit: true, menuId: true },
  });
  if (!stockSupply) return res.status(404).json({ error: "Stock supply not found" });

  // Total received via fulfillments
  const totalFulfilled = await prisma.stockFulfillmentItem.aggregate({
    _sum: { quantityDelivered: true },
    where: { stockRequestItem: { stockSupplyId: id } },
  });

  // Total cooked
  const totalCooked = await prisma.cookingRecord.aggregate({
    _sum: { quantityCooked: true },
    where: { stockSupplyId: id },
  });

  const received = Number(totalFulfilled._sum.quantityDelivered ?? 0);
  const cooked = Number(totalCooked._sum.quantityCooked ?? 0);
  const kitchenInventory = received - cooked;

  res.json({
    ...serializeStockSupply(stockSupply),
    totalReceived: received,
    totalCooked: cooked,
    kitchenInventory,
  });
});

// GET /api/stock-supplies/:id - Get single item
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const item = await prisma.stockSupply.findUnique({
    where: { id },
  });
  if (!item) return res.status(404).json({ error: "Item not found" });
  res.json(serializeStockSupply(item));
});

// POST /api/stock-supplies - Create item
router.post("/", upload.single("image"), async (req, res) => {
  const { name, slug, description, unit, currentStock, reorderLevel } = req.body;
  const image = req.file ? `/uploads/stock-supplies/${req.file.filename}` : null;
  
  if (!name || !unit || !image) {
    return res.status(400).json({ error: "name, unit, and image are required" });
  }
  
  if (!VALID_UNITS.includes(unit)) {
    return res.status(400).json({ error: `Invalid unit: ${unit}. Must be one of: ${VALID_UNITS.join(", ")}` });
  }
  
  const generatedSlug = slug || name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  
  try {
    const item = await prisma.stockSupply.create({
      data: {
        name,
        slug: generatedSlug,
        description,
        unit,
        currentStock: currentStock ?? 0,
        reorderLevel,
        image,
      },
    });
    res.status(201).json(serializeStockSupply(item));
  } catch (e: any) {
    if (e.code === "P2002") return res.status(409).json({ error: "Item slug already exists" });
    throw e;
  }
});

// PUT /api/stock-supplies/:id - Update item
router.put("/:id", upload.single("image"), async (req, res) => {
  const { id } = req.params;
  const { name, slug, description, unit, currentStock, reorderLevel, isActive } = req.body;
  
  if (unit && !VALID_UNITS.includes(unit)) {
    return res.status(400).json({ error: `Invalid unit: ${unit}. Must be one of: ${VALID_UNITS.join(", ")}` });
  }
  
  const existing = await prisma.stockSupply.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Item not found" });
  
  if (!req.file) {
    return res.status(400).json({ error: "Image file is required" });
  }
  
  const newImage = `/uploads/stock-supplies/${req.file.filename}`;
  
  if (newImage && existing.image) {
    deleteImageFile(existing.image);
  }
  
  try {
    const item = await prisma.stockSupply.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(slug !== undefined && { slug }),
        ...(description !== undefined && { description }),
        ...(unit !== undefined && { unit }),
        ...(currentStock !== undefined && { currentStock }),
        ...(reorderLevel !== undefined && { reorderLevel }),
        ...(isActive !== undefined && { isActive }),
        image: newImage,
      },
    });
    res.json(serializeStockSupply(item));
  } catch (e: any) {
    if (e.code === "P2025") return res.status(404).json({ error: "Item not found" });
    if (e.code === "P2002") return res.status(409).json({ error: "Item slug already exists" });
    throw e;
  }
});

// DELETE /api/stock-supplies/:id - Soft delete (set isActive = false)
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const item = await prisma.stockSupply.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ error: "Item not found" });
    
    if (item.image) deleteImageFile(item.image);
    
    await prisma.stockSupply.update({
      where: { id },
      data: { isActive: false },
    });
    res.json({ message: "Item deactivated", id });
  } catch (e: any) {
    if (e.code === "P2025") return res.status(404).json({ error: "Item not found" });
    throw e;
  }
});

export default router;
