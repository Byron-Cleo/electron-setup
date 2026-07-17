# Stock Supply Image Upload — Complete Plan

## Overview

Add image upload capability to StockSupply records so staff can visually identify stock items. Images are uploaded via the existing create/update endpoints using multipart form data, stored locally, and served as static files.

---

## Architecture

```
Frontend (FormData with file)
  → POST/PUT /api/stock-supplies or /api/stock-supplies/:id
    → Multer middleware (parses multipart, saves to disk)
      → Express route handler (stores path in DB)
        → Static file serving (/uploads/stock-supplies/*)
```

---

## Phases

### Phase 1 — Backend: Schema + Upload Endpoint
**File:** `@context/features/backend/stock-supply-image-upload-phase-1-backend.md`

- Install multer
- Add `image` field to StockSupply in Prisma schema
- Run migration
- Add static file serving in app.ts
- Update POST /api/stock-supplies to handle multipart/form-data
- Update PUT /api/stock-supplies/:id to handle multipart/form-data
- Include image path in all GET responses

### Phase 2 — Frontend: Types + API + UI
**File:** `@context/features/frontend/stock-supply-image-upload-phase-2-frontend.md`

- Update StockSupply type with `image` field
- Update createStockSupply/updateStockSupply in lib/api.ts to send FormData when image present
- Add image upload UI to StockSupplyForm
- Add image upload UI to StockSupplyEditDialog
- Display thumbnail in Store StockView table
- Display thumbnail in StockSupplies table

---

## Image Storage

- **Location:** `backend/uploads/stock-supplies/`
- **Naming:** `{uuid}.{ext}` (e.g. `a1b2c3d4.jpg`)
- **Serving:** `GET /uploads/stock-supplies/:filename` via express.static
- **Max size:** 5MB
- **Allowed types:** jpg, jpeg, png, webp

---

## Files Modified

### Backend
| File | Change |
|------|--------|
| `backend/package.json` | Add multer dependency |
| `backend/prisma/schema.prisma` | Add `image String?` to StockSupply |
| `backend/app.ts` | Add static file serving + multer config |
| `backend/routes/items.ts` | Update POST/PUT to handle file upload |

### Frontend
| File | Change |
|------|--------|
| `desktop/ui/types/electron.d.ts` | Add `image` to StockSupply type |
| `desktop/ui/lib/api.ts` | Send FormData for create/update |
| `desktop/ui/pages/admin/StockSupplyForm.tsx` | Add image upload field |
| `desktop/ui/components/admin/StockSupplyEditDialog.tsx` | Add image upload field |
| `desktop/ui/pages/Store.tsx` | Show thumbnail in stock table |
| `desktop/ui/pages/admin/StockSupplies.tsx` | Show thumbnail in stock table |

---

## API Contract

### POST /api/stock-supplies
```
Content-Type: multipart/form-data

Fields:
  name: string (required)
  slug?: string
  description?: string
  unit: string (required)
  categoryId: string (required)
  currentStock?: number
  reorderLevel?: number
  image?: File
```

### PUT /api/stock-supplies/:id
```
Content-Type: multipart/form-data

Fields: (same as POST, all optional)
```

### Response includes:
```json
{
  "id": "...",
  "name": "...",
  "image": "/uploads/stock-supplies/abc123.jpg | null",
  ...
}
```
