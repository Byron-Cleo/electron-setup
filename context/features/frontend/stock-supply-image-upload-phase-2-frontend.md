# Stock Supply Image Upload — Phase 2: Frontend Types + API + UI

## Platform

frontend

## Status

Not Started

## Goals

- Add `image` field to StockSupply TypeScript type
- Update createStockSupply/updateStockSupply in lib/api.ts to send FormData when image present
- Add image upload UI with preview to StockSupplyForm (create/edit pages)
- Add image upload UI with preview to StockSupplyEditDialog (modal)
- Display thumbnail in Store StockView table
- Display thumbnail in StockSupplies table

## Notes

- FormData is only used when an image file is selected; otherwise send JSON as before
- Image preview shows current image (edit mode) or selected file (before upload)
- Thumbnail in tables: 40x40 rounded, object-cover
- No image placeholder: gray box with Package icon
- Full implementation plan in @context/project-plan/stock-supply-image-upload.md

## Implementation Steps

### Step 1: Update TypeScript Type

In `desktop/ui/types/electron.d.ts`, add to StockSupply:
```typescript
image: string | null
```

### Step 2: Update lib/api.ts

Update `createStockSupply` and `updateStockSupply` to conditionally send FormData:

```typescript
export async function createStockSupply(data: CreateStockSupplyData, imageFile?: File) {
  if (imageFile) {
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) formData.append(key, String(value))
    })
    formData.append("image", imageFile)
    return apiFetch<StockSupply>("/api/stock-supplies", { method: "POST", body: formData })
  }
  return apiFetch<StockSupply>("/api/stock-supplies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
}

// Same pattern for updateStockSupply
```

### Step 3: Image Upload Component

Create a reusable `ImageUpload` component (or inline in forms):
- File input (accept="image/jpeg,image/png,image/webp")
- Preview area (current image or selected file)
- Remove button to clear selection
- Max 5MB validation on client side

### Step 4: Update StockSupplyForm

- Add image field below reorder level
- Show current image if editing
- On submit, pass selected file to createStockSupply/updateStockSupply

### Step 5: Update StockSupplyEditDialog

- Same image upload UI as StockSupplyForm
- Pass selected file to updateStockSupply

### Step 6: Update Store StockView Table

- Add thumbnail column (40x40, rounded, object-cover)
- Fallback to Package icon when no image

### Step 7: Update StockSupplies Table

- Add thumbnail column (same as Store StockView)

## Files Modified

| File | Change |
|------|--------|
| `desktop/ui/types/electron.d.ts` | Add `image: string \| null` to StockSupply |
| `desktop/ui/lib/api.ts` | Send FormData when image present |
| `desktop/ui/pages/admin/StockSupplyForm.tsx` | Image upload field with preview |
| `desktop/ui/components/admin/StockSupplyEditDialog.tsx` | Image upload field with preview |
| `desktop/ui/pages/Store.tsx` | Thumbnail column in stock table |
| `desktop/ui/pages/admin/StockSupplies.tsx` | Thumbnail column in stock table |

## Verification

1. `npx tsc --noEmit` passes
2. `npm run lint` passes
3. Create stock supply with image → image uploads, displays in table
4. Edit stock supply, change image → old image replaced, new image displays
5. Edit stock supply without changing image → image preserved
6. Stock table shows thumbnails, fallback icon when no image
