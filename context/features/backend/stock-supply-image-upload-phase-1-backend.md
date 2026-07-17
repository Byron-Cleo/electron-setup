# Stock Supply Image Upload — Phase 1: Backend Schema + Upload Handling

## Platform

backend

## Status

Not Started

## Goals

- Install multer for multipart/form-data handling
- Add `image` field to StockSupply in Prisma schema
- Add static file serving for uploaded images
- Update POST /api/stock-supplies to accept image file via multer
- Update PUT /api/stock-supplies/:id to accept image file via multer
- Include image path in all GET responses

## Notes

- Multer saves files to `backend/uploads/stock-supplies/`
- Files named with UUID to avoid conflicts: `{uuid}.{original_ext}`
- Max file size: 5MB
- Allowed MIME types: image/jpeg, image/png, image/webp
- express.static serves `/uploads/stock-supplies/*` at root URL
- When updating with a new image, delete the old image file from disk
- Full implementation plan in @context/project-plan/stock-supply-image-upload.md

## Implementation Steps

### Step 1: Install multer

```bash
cd backend && npm install multer && npm install -D @types/multer
```

### Step 2: Prisma Schema Update

Add to StockSupply model:
```prisma
image String?
```

Run migration:
```bash
npx prisma migrate dev --name add-stock-supply-image
```

### Step 3: Static File Serving (app.ts)

```typescript
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Serve uploaded stock supply images
app.use("/uploads/stock-supplies", express.static(path.join(__dirname, "uploads/stock-supplies")));
```

Create the directory: `backend/uploads/stock-supplies/`

### Step 4: Multer Config (items.ts)

```typescript
import multer from "multer";
import path from "path";
import crypto from "crypto";

const storage = multer.diskStorage({
  destination: path.resolve(__dirname, "../uploads/stock-supplies"),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    cb(null, allowed.includes(file.mimetype));
  },
});
```

### Step 5: Update POST Route

```typescript
router.post("/", upload.single("image"), async (req, res) => {
  const { name, slug, description, unit, categoryId, currentStock, reorderLevel } = req.body;
  const image = req.file ? `/uploads/stock-supplies/${req.file.filename}` : null;
  // ... rest of handler, include image in create data
});
```

### Step 6: Update PUT Route

```typescript
router.put("/:id", upload.single("image"), async (req, res) => {
  // If new image uploaded, delete old one
  // Update all fields including image
});
```

### Step 7: Cleanup Old Images

Add a helper function:
```typescript
import fs from "fs";

function deleteImageFile(imagePath: string | null) {
  if (!imagePath) return;
  const fullPath = path.resolve(__dirname, "..", imagePath);
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
}
```

Call before updating with new image or on delete.

## Verification

1. `npx prisma migrate dev` succeeds
2. `npm run dev` starts without errors
3. `POST /api/stock-supplies` with multipart form data saves image and returns path
4. `PUT /api/stock-supplies/:id` with new image replaces old file
5. `GET /api/stock-supplies` and `GET /api/stock-supplies/:id` return `image` field
6. `GET /uploads/stock-supplies/:filename` serves the image file
