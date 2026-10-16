import { Router } from "express";
import prisma from "../db/db.js";

const router = Router();

// Global app settings singleton (id = 1). Pre-auth read is deliberate: the
// Kitchen screens need the go-live flag before any admin action, and the whole
// API follows the same LAN trust model (see loginMedia.ts). The admin-only
// restriction on WRITING it is enforced by the Settings UI, not a middleware.

// Fresh installs may have no row yet — mint the default on first touch.
async function ensureSettings() {
  return prisma.systemSettings.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });
}

// GET /api/system-settings - public: Kitchen reads showGoLiveInput from here.
router.get("/", async (_req, res) => {
  try {
    const settings = await ensureSettings();
    res.json(settings);
  } catch (e) {
    console.error("Error reading system settings:", e);
    res.status(500).json({ error: "Failed to read system settings" });
  }
});

// PUT /api/system-settings - update the singleton. Admin-only in the UI.
router.put("/", async (req, res) => {
  const { showGoLiveInput } = req.body ?? {};

  if (showGoLiveInput !== undefined && typeof showGoLiveInput !== "boolean") {
    return res.status(400).json({ error: "showGoLiveInput must be a boolean" });
  }

  try {
    const settings = await prisma.systemSettings.upsert({
      where: { id: 1 },
      create: { id: 1, showGoLiveInput: showGoLiveInput ?? true },
      update: showGoLiveInput !== undefined ? { showGoLiveInput } : {},
    });
    res.json(settings);
  } catch (e) {
    console.error("Error updating system settings:", e);
    res.status(500).json({ error: "Failed to update system settings" });
  }
});

export default router;
