# Multi-Select Menu — Phase 2: Types + API Layer

## Platform

frontend

## Status

Not Started

## Goals

- Update `StockSupply` type: `menuId: string | null` → `menuIds: string[]`, `menu?` → `menus?: { id: string; name: string }[]`
- Update `StockSupplyCreateData` and `StockSupplyUpdateData`: `menuId` → `menuIds: string[]`
- Update `createStockSupply` and `updateStockSupply` API functions to send `menuIds` as JSON string
- Update `CookedMenuItem.stockSupply` to include `menus` array

## Notes

- `menuIds` is sent as `JSON.stringify(array)` in FormData (same pattern as `departmentIds`)
- The backend parses it back with `JSON.parse(menuIds)`
- Keep backward compatibility: if `menuIds` is undefined/empty, send nothing (backend treats as empty array)

## Type Changes

### `desktop/ui/types/electron.d.ts`

```typescript
// StockSupply interface
interface StockSupply {
  // ... existing fields ...
  // REMOVE: menuId: string | null;
  // REMOVE: menu?: { id: string; name: string } | null;
  // ADD:
  menus?: { id: string; name: string }[];
  // ... rest ...
}

// StockSupplyCreateData
interface StockSupplyCreateData {
  // ... existing fields ...
  // REMOVE: menuId?: string | null;
  // ADD:
  menuIds?: string[];
  // ... rest ...
}

// StockSupplyUpdateData (same change)
interface StockSupplyUpdateData {
  // ... existing fields ...
  // REMOVE: menuId?: string | null;
  // ADD:
  menuIds?: string[];
  // ... rest ...
}

// CookedMenuItem — stockSupply already shows a single object,
// but now it may come from multiple stock supplies via junction.
// The backend returns stockSupply as the first linked one for display.
// No change needed here — the junction is between Menu ↔ StockSupply,
// and the cooked query aggregates across all linked stock supplies.
```

## API Changes

### `desktop/ui/lib/api.ts`

Update `createStockSupply`:
```typescript
export async function createStockSupply(data: StockSupplyCreateData, image?: File) {
  const body = new FormData();
  // ... existing field appending ...
  // REMOVE: if (data.menuId) body.append("menuId", data.menuId);
  // ADD:
  if (data.menuIds && data.menuIds.length > 0) {
    body.append("menuIds", JSON.stringify(data.menuIds));
  }
  // ... rest ...
}
```

Update `updateStockSupply`:
```typescript
export async function updateStockSupply(id: string, data: StockSupplyUpdateData, image?: File) {
  const body = new FormData();
  // ... existing field appending ...
  // REMOVE: if (data.menuId !== undefined) body.append("menuId", data.menuId ?? "");
  // ADD:
  if (data.menuIds !== undefined) {
    body.append("menuIds", JSON.stringify(data.menuIds));
  }
  // ... rest ...
}
```

## Verification

- TypeScript compiles with no errors
- `createStockSupply` sends `menuIds` as JSON string in FormData
- `updateStockSupply` sends `menuIds` as JSON string in FormData
- `StockSupply` type has `menus` array instead of `menuId` string
