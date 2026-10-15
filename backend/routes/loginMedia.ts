import { Router } from "express";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import multer from "multer";
import prisma from "../db/db.js";
import { Prisma } from "../db/generated/prisma/client.js";
import { uploadsDir, uploadsRoot } from "../db/uploads.js";

const router = Router();

// The login screen's left panel: admin-curated images (checkboxes over every
// image in the menu upload folders) and/or muted video playback. Two rules
// drive the whole route:
//   1. IMAGES is the default and the universal fallback — video only ever
//      plays when the saved config explicitly says VIDEO and a playable clip
//      actually exists (effective-mode computed here, not trusted from DB).
//   2. The public GET is pre-auth (the login screen predates any session),
//      same LAN trust model as GET /menu/images.

const IMAGE_SUBDIRS = ["menu-items", "menu-accompaniments"];
const IMAGE_EXT_RE = /\.(png|jpe?g|webp)$/i;
const VIDEO_MIMES = ["video/mp4", "video/webm"];
const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500 MB — H.264 mp4 for Electron/Chromium
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIN_SLIDE_SEC = 1;
const MAX_SLIDE_SEC = 30;

// Every image a form upload can produce, same scan as GET /menu/images.
async function scanFolderImages(): Promise<string[]> {
  const images: string[] = [];
  for (const sub of IMAGE_SUBDIRS) {
    let files: string[] = [];
    try {
      files = await fs.readdir(uploadsDir(sub));
    } catch {
      files = [];
    }
    images.push(
      ...files
        .filter((f) => IMAGE_EXT_RE.test(f))
        .sort()
        .map((f) => `/uploads/${sub}/${f}`),
    );
  }
  return images;
}

// Singleton config row, created on first touch (fresh installs).
async function ensureConfig() {
  return prisma.loginMediaConfig.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });
}

// First-run backfill: seed active IMAGE rows from the folder scan so the
// deployed panel keeps showing exactly what it shows today. Runs only when no
// IMAGE row exists yet — afterwards the admin's checkboxes are the truth.
async function backfillImagesOnce() {
  const count = await prisma.loginMedia.count({ where: { kind: "IMAGE" } });
  if (count > 0) return;
  const scan = await scanFolderImages();
  if (scan.length === 0) return;
  await prisma.loginMedia.createMany({
    data: scan.map((filePath) => ({ kind: "IMAGE" as const, filePath, isActive: true })),
  });
}

async function ensureDefaults() {
  await ensureConfig();
  await backfillImagesOnce();
}

// Effective display for the login screen: config + files reconciled server-side
// so a VIDEO mode with nothing playable (or a dangling single-clip reference)
// degrades to whatever CAN show, never to a blank panel.
async function computeDisplay() {
  await ensureDefaults();
  const config = await ensureConfig();
  const scan = new Set(await scanFolderImages());

  const imageRows = await prisma.loginMedia.findMany({
    where: { kind: "IMAGE", isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const images = imageRows.map((r) => r.filePath).filter((p) => scan.has(p));

  const videoRows = await prisma.loginMedia.findMany({
    where: { kind: "VIDEO", isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const videos = videoRows.map((r) => ({ id: r.id, url: r.filePath }));

  let mode = config.mode;
  if (mode === "VIDEO" && videos.length === 0) mode = "IMAGES";

  let videoPlayback = config.videoPlayback;
  let singleVideo: { id: string; url: string } | null = null;
  if (videoPlayback === "SINGLE_LOOP") {
    const sv = config.singleVideoId ? videos.find((v) => v.id === config.singleVideoId) : undefined;
    if (sv) singleVideo = sv;
    else videoPlayback = "PLAYLIST"; // missing/disabled clip → play the rest, or images if none
  }

  return {
    mode, // effective — what the login pane must render
    slideIntervalSec: config.slideIntervalSec,
    videoPlayback, // effective — SINGLE_LOOP only when its clip is playable
    singleVideo,
    images,
    videos,
  };
}

// GET /api/login-media — public (login screen is pre-auth). Effective display.
router.get("/", async (_req, res) => {
  try {
    res.json(await computeDisplay());
  } catch (e) {
    console.error("login-media display failed:", e);
    res.status(500).json({ error: "Failed to load login media" });
  }
});

// GET /api/login-media/library — admin state: raw config + every scanned image
// (with its checkbox state) + every video (including disabled, for re-enable).
router.get("/library", async (_req, res) => {
  try {
    await ensureDefaults();
    const config = await ensureConfig();
    const scan = await scanFolderImages();
    const imageRows = await prisma.loginMedia.findMany({ where: { kind: "IMAGE" } });
    const activeByPath = new Map(imageRows.map((r) => [r.filePath, r.isActive]));
    const images = scan.map((filePath) => ({
      filePath,
      isActive: activeByPath.get(filePath) ?? false,
    }));
    const videoRows = await prisma.loginMedia.findMany({
      where: { kind: "VIDEO" },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    res.json({
      config: {
        mode: config.mode,
        videoPlayback: config.videoPlayback,
        singleVideoId: config.singleVideoId,
        slideIntervalSec: config.slideIntervalSec,
      },
      images,
      videos: videoRows.map((r) => ({
        id: r.id,
        url: r.filePath,
        isActive: r.isActive,
        sortOrder: r.sortOrder,
      })),
    });
  } catch (e) {
    console.error("login-media library failed:", e);
    res.status(500).json({ error: "Failed to load login media library" });
  }
});

// PUT /api/login-media/config — partial update of the singleton.
// Backstops mirror the UI guards: VIDEO requires an active video;
// SINGLE_LOOP requires a playable one.
router.put("/config", async (req, res) => {
  try {
    const { mode, videoPlayback, singleVideoId, slideIntervalSec } = req.body ?? {};

    if (mode !== undefined && mode !== "IMAGES" && mode !== "VIDEO") {
      return res.status(400).json({ error: "mode must be IMAGES or VIDEO" });
    }
    if (
      videoPlayback !== undefined &&
      videoPlayback !== "SINGLE_LOOP" &&
      videoPlayback !== "PLAYLIST"
    ) {
      return res.status(400).json({ error: "videoPlayback must be SINGLE_LOOP or PLAYLIST" });
    }
    if (singleVideoId !== undefined && singleVideoId !== null) {
      if (typeof singleVideoId !== "string" || !UUID_RE.test(singleVideoId)) {
        return res.status(400).json({ error: "singleVideoId must be a video id" });
      }
    }
    if (slideIntervalSec !== undefined) {
      if (typeof slideIntervalSec !== "number" || !Number.isFinite(slideIntervalSec)) {
        return res.status(400).json({ error: "slideIntervalSec must be a number" });
      }
    }

    await ensureDefaults();
    const current = await ensureConfig();
    const next = {
      mode: (mode as typeof current.mode | undefined) ?? current.mode,
      videoPlayback: (videoPlayback as typeof current.videoPlayback | undefined) ?? current.videoPlayback,
      singleVideoId:
        singleVideoId !== undefined ? (singleVideoId as string | null) : current.singleVideoId,
      slideIntervalSec:
        slideIntervalSec !== undefined
          ? Math.min(MAX_SLIDE_SEC, Math.max(MIN_SLIDE_SEC, Math.round(slideIntervalSec)))
          : current.slideIntervalSec,
    };

    const activeVideos = await prisma.loginMedia.findMany({
      where: { kind: "VIDEO", isActive: true },
      select: { id: true },
    });
    if (next.mode === "VIDEO" && activeVideos.length === 0) {
      return res.status(400).json({ error: "Upload a video before switching to video mode" });
    }
    if (next.singleVideoId !== null && !activeVideos.some((v) => v.id === next.singleVideoId)) {
      return res.status(400).json({ error: "The selected loop video does not exist or is disabled" });
    }
    // Only bind the invariant when video playback is actually in effect:
    // videoPlayback is irrelevant in IMAGES mode, and the default row is
    // SINGLE_LOOP with no clip, so partial updates (mode, interval) must stay
    // legal while images are showing.
    if (next.mode === "VIDEO" && next.videoPlayback === "SINGLE_LOOP" && next.singleVideoId === null) {
      return res.status(400).json({ error: "Choose a video to loop" });
    }

    const saved = await prisma.loginMediaConfig.update({ where: { id: 1 }, data: next });
    res.json({
      mode: saved.mode,
      videoPlayback: saved.videoPlayback,
      singleVideoId: saved.singleVideoId,
      slideIntervalSec: saved.slideIntervalSec,
    });
  } catch (e) {
    console.error("login-media config update failed:", e);
    res.status(500).json({ error: "Failed to save login media config" });
  }
});

// PUT /api/login-media/images/selection — the checkbox save. Scan is
// authoritative: unknown paths are ignored, rows for vanished files are
// removed, absent rows are created only when selected (lean table).
router.put("/images/selection", async (req, res) => {
  try {
    const { activePaths } = req.body ?? {};
    if (!Array.isArray(activePaths) || activePaths.some((p) => typeof p !== "string")) {
      return res.status(400).json({ error: "activePaths must be an array of strings" });
    }

    const scan = await scanFolderImages();
    const scanSet = new Set(scan);
    const selected = new Set(activePaths.filter((p) => scanSet.has(p)));
    const rows = await prisma.loginMedia.findMany({ where: { kind: "IMAGE" } });
    const rowByPath = new Map(rows.map((r) => [r.filePath, r]));

    const ops: Prisma.PrismaPromise<unknown>[] = [];
    for (const row of rows) {
      if (!scanSet.has(row.filePath)) ops.push(prisma.loginMedia.delete({ where: { id: row.id } }));
    }
    for (const filePath of scan) {
      const want = selected.has(filePath);
      const row = rowByPath.get(filePath);
      if (!row) {
        if (want) {
          ops.push(prisma.loginMedia.create({ data: { kind: "IMAGE", filePath, isActive: true } }));
        }
      } else if (row.isActive !== want) {
        ops.push(prisma.loginMedia.update({ where: { id: row.id }, data: { isActive: want } }));
      }
    }
    if (ops.length > 0) await prisma.$transaction(ops);
    res.json({ selected: selected.size, total: scan.length });
  } catch (e) {
    console.error("login-media selection save failed:", e);
    res.status(500).json({ error: "Failed to save image selection" });
  }
});

const videoStorage = multer.diskStorage({
  destination: uploadsDir("login-media"),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".mp4";
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const uploadVideo = multer({
  storage: videoStorage,
  limits: { fileSize: MAX_VIDEO_BYTES },
  fileFilter: (_req, file, cb) => {
    cb(null, VIDEO_MIMES.includes(file.mimetype));
  },
});

// POST /api/login-media/videos — upload a clip. Uploading alone changes
// nothing on screen: the row is stored active, but the login pane only plays
// video after the admin flips the config mode to VIDEO.
router.post("/videos", uploadVideo.single("video"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No video file uploaded (mp4/webm, max 500MB)" });
    }
    const filePath = `/uploads/login-media/${req.file.filename}`;
    const maxRow = await prisma.loginMedia.aggregate({
      where: { kind: "VIDEO" },
      _max: { sortOrder: true },
    });
    const row = await prisma.loginMedia.create({
      data: { kind: "VIDEO", filePath, isActive: true, sortOrder: (maxRow._max.sortOrder ?? -1) + 1 },
    });
    res.status(201).json({ id: row.id, url: row.filePath, isActive: row.isActive, sortOrder: row.sortOrder });
  } catch (e) {
    console.error("login-media video upload failed:", e);
    res.status(500).json({ error: "Failed to store video" });
  }
});

// PUT /api/login-media/videos/order — full reorder: ids must list every
// video exactly once; sortOrder is renumbered by index.
router.put("/videos/order", async (req, res) => {
  try {
    const { ids } = req.body ?? {};
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
      return res.status(400).json({ error: "ids must be an array of video ids" });
    }
    const videos = await prisma.loginMedia.findMany({ where: { kind: "VIDEO" } });
    const known = new Set(videos.map((v) => v.id));
    if (new Set(ids).size !== ids.length || ids.length !== videos.length || !ids.every((id) => known.has(id))) {
      return res.status(400).json({ error: "ids must list every video exactly once" });
    }
    await prisma.$transaction(
      ids.map((id, index) => prisma.loginMedia.update({ where: { id }, data: { sortOrder: index } })),
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("login-media video reorder failed:", e);
    res.status(500).json({ error: "Failed to reorder videos" });
  }
});

// PATCH /api/login-media/videos/:id — enable/disable. Disabling the clip the
// config points at clears singleVideoId so the invariant stays honest
// (effective playback then falls back to playlist → images).
router.patch("/videos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!UUID_RE.test(id)) return res.status(404).json({ error: "Not found" });
    const { isActive } = req.body ?? {};
    if (typeof isActive !== "boolean") {
      return res.status(400).json({ error: "isActive must be a boolean" });
    }
    const row = await prisma.loginMedia.findUnique({ where: { id } });
    if (!row || row.kind !== "VIDEO") return res.status(404).json({ error: "Not found" });

    const config = await ensureConfig();
    if (!isActive && config.singleVideoId === row.id) {
      await prisma.loginMediaConfig.update({ where: { id: 1 }, data: { singleVideoId: null } });
    }
    const updated = await prisma.loginMedia.update({ where: { id }, data: { isActive } });
    res.json({ id: updated.id, isActive: updated.isActive });
  } catch (e) {
    console.error("login-media video toggle failed:", e);
    res.status(500).json({ error: "Failed to update video" });
  }
});

// DELETE /api/login-media/videos/:id — remove row + file (best effort), clear
// a dangling singleVideoId reference.
router.delete("/videos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!UUID_RE.test(id)) return res.status(404).json({ error: "Not found" });
    const row = await prisma.loginMedia.findUnique({ where: { id } });
    if (!row || row.kind !== "VIDEO") return res.status(404).json({ error: "Not found" });

    const config = await ensureConfig();
    if (config.singleVideoId === row.id) {
      await prisma.loginMediaConfig.update({ where: { id: 1 }, data: { singleVideoId: null } });
    }
    await prisma.loginMedia.delete({ where: { id: row.id } });

    // Best-effort unlink, confined to the uploads root. filePath is a URL path
    // (/uploads/login-media/x.mp4) while uploadsRoot() IS the uploads dir, so
    // drop the leading "/uploads/" segment before resolving against disk.
    const uploads = uploadsRoot();
    const rel = row.filePath.replace(/^\/+/, "");
    const relOnDisk = rel.startsWith("uploads/") ? rel.slice("uploads/".length) : rel;
    const abs = path.resolve(uploads, relOnDisk);
    if (abs.startsWith(uploads + path.sep)) {
      try {
        await fs.unlink(abs);
      } catch {
        /* already gone — row deletion is what matters */
      }
    }
    res.json({ message: "Video deleted" });
  } catch (e) {
    console.error("login-media video delete failed:", e);
    res.status(500).json({ error: "Failed to delete video" });
  }
});

export default router;
