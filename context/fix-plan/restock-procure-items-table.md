# Restock/Procure Items Table

## Overview
Implement the `RestockView` component to display a data table of low stock items that need restocking, with a Restock modal for entering restock quantities and a post-submit option to view the shopping list.

## Goals
- Display table of items where `currentStock <= reorderLevel`
- Columns: Details, Image, Name, Stock, Stock Status, Restock Quantity, Actions
- Details button opens modal popup showing full item details
- Restock button opens modal with quantity input
- After submitting restock quantity, show option to view shopping list
- Badge on thumbnail shows count of low stock items (already exists)

## Data Source

### Backend Endpoint (new)
```
GET /api/stock-supplies/low-stock
```
Returns all active stock supplies where `currentStock <= reorderLevel` and `reorderLevel IS NOT NULL`.

### Frontend API Function (new)
```ts
export async function getLowStockSupplies(): Promise<StockSupply[]>
```
Add to `desktop/ui/lib/api.ts` following existing pattern.

### Backend Route
Add to `backend/routes/items.ts` before the `/:id` route (to avoid conflict):
```ts
router.get("/low-stock", async (_req, res) => {
  const items = await prisma.stockSupply.findMany({
    where: {
      isActive: true,
      reorderLevel: { not: null },
    },
    orderBy: { name: "asc" },
  });

  const lowStockItems = items.filter(
    (item) => Number(item.currentStock) <= Number(item.reorderLevel!)
  );

  res.json(lowStockItems.map(serializeStockSupply));
});
```

## Table Columns

| # | Key | Label | Width | Notes |
|---|-----|-------|-------|-------|
| 1 | details | Details | auto | Button opens detail modal popup |
| 2 | image | Image | auto | 40x40 thumbnail, Package icon fallback |
| 3 | name | Name | auto | Stock supply name |
| 4 | stock | Stock | auto | Formatted with unit (e.g., "5 kg") |
| 5 | stockStatus | Stock Status | auto | Badge: Available/Restock/Not Available |
| 6 | restockQty | Restock Quantity | auto | `reorderLevel - currentStock` (quantity needed) |
| 7 | actions | Actions | auto | Restock button |

### Stock Status Logic
Reuse existing `computeStockStatus()` from Store.tsx:
- `currentStock <= 0` → "Not Available" (red badge)
- `currentStock <= reorderLevel` → "Restock" (amber badge)
- Otherwise → "Available" (green badge)

### Restock Quantity Column
Shows how much needs to be ordered: `reorderLevel - currentStock`
- Display as formatted quantity with unit
- If result is 0 or negative, show "—" (shouldn't happen for low stock items)

## Details Modal
- Reuse existing `StockSupplyDetailDialog` component
- Opens when user clicks "Details" button in the row
- Shows full item information (name, description, stock, reorder level, image, etc.)

## Restock Modal

### Design
```
┌─────────────────────────────────────────┐
│         Restock / Procure Item          │
├─────────────────────────────────────────┤
│  Item: [Item Name]                      │
│  Current Stock: [X units]               │
│  Reorder Level: [Y units]               │
│  ─────────────────────────────────────  │
│  Restock Quantity: [  input field  ]    │
│  Unit: [unit]                           │
├─────────────────────────────────────────┤
│              [Cancel]  [Submit]         │
└─────────────────────────────────────────┘
```

### Modal Fields
- **Read-only**: Item name, current stock, reorder level, unit
- **Input**: Restock quantity (number input, min=1, step=1)
- **Buttons**: Cancel (closes modal), Submit (saves restock quantity)

### State
- `restockTarget: StockSupply | null` — item being restocked
- `restockQuantity: string` — quantity input value
- `restockSubmitting: boolean` — loading state

### On Submit
1. Store the restock quantity locally (no backend persistence yet)
2. Close the restock modal
3. Show a confirmation/toast with option to "View Shopping List"
4. Shopping list view is deferred — just the table and modal for now

## Post-Submit Flow
After submitting restock quantity:
- Show a success message or update the row to indicate restock quantity has been set
- Add a "View Shopping List" button (can be a future feature — for now just show a placeholder or disabled button)

## Files to Create
| File | Action |
|---|---|
| `context/fix-plan/restock-procure-items-table.md` | This plan |
| `context/features/frontend/restock-procure-items-table.md` | Feature spec for loading |

## Files to Modify
| File | Action |
|---|---|
| `backend/routes/items.ts` | Add `GET /low-stock` endpoint |
| `desktop/ui/lib/api.ts` | Add `getLowStockSupplies()` function |
| `desktop/ui/pages/Store.tsx` | Implement `RestockView` component |

## Verification
- Thumbnail badge shows correct low stock count
- Clicking thumbnail shows table with all low stock items
- Table columns render correctly (Details, Image, Name, Stock, Stock Status, Restock Quantity, Actions)
- Details button opens StockSupplyDetailDialog modal
- Restock button opens restock modal with correct item info
- Restock quantity input accepts positive numbers
- Submit closes modal and shows confirmation
- No TypeScript errors (`tsc --noEmit`)
- No lint errors (`npm run lint`)
