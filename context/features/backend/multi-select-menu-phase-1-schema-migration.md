# Multi-Select Menu — Phase 1: Schema + Migration

## Platform

backend

## Status

Not Started

## Goals

- Add `StockSupplyMenu` junction table to Prisma schema
- Remove single `menuId` column from `StockSupply` model
- Add `menus` relation to `StockSupply` and `Menu` models
- Run migration to sync database

## Notes

- This is a **breaking schema change** — `menuId` is removed, routes will break until Phase 2
- The junction table enables many-to-many: one stock supply ↔ many menus
- Use `onDelete: Cascade` so deleting a stock supply or menu cleans up the junction
- Existing `menuId` data will be LOST during migration — acceptable since this is a new feature with minimal production data

## Schema Changes

### New model: StockSupplyMenu

```prisma
model StockSupplyMenu {
  stockSupplyId String @db.Uuid
  menuId        String @db.Uuid
  stockSupply   StockSupply @relation(fields: [stockSupplyId], references: [id], onDelete: Cascade)
  menu          Menu        @relation(fields: [menuId], references: [id], onDelete: Cascade)
  @@id([stockSupplyId, menuId])
}
```

### Modified: StockSupply

Remove:
```prisma
menuId   String?  @db.Uuid
menu     Menu?    @relation(fields: [menuId], references: [id])
```

Add:
```prisma
menus    StockSupplyMenu[]
```

### Modified: Menu

Add:
```prisma
stockSupplyMenus StockSupplyMenu[]
```

## Migration

Run `npx prisma migrate dev --name multi-select-menu` after schema changes.

## Verification

- `npx prisma migrate dev` completes without errors
- `npx prisma generate` succeeds
- Database has `StockSupplyMenu` table with `stockSupplyId` + `menuId` composite PK
- `StockSupply` table no longer has `menuId` column
