-- Step 1: Drop duplicate unique index on Shift
DROP INDEX IF EXISTS "Shift_type_date_key";

-- Step 2: Drop duplicate unique index on OrderItem
DROP INDEX IF EXISTS "orderitems_order_menu_starch_veg_key";

-- Step 3: Add missing columns to Order table (IF NOT EXISTS for safety)
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "unpaidAcknowledged" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "unpaidAcknowledgedById" UUID;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "unpaidAcknowledgedAt" TIMESTAMPTZ(6);

-- Step 4: Add missing column to Shift table
ALTER TABLE "Shift" ADD COLUMN IF NOT EXISTS "finalCloseSource" TEXT;

-- Step 5: Add missing unique constraints for data integrity
CREATE UNIQUE INDEX IF NOT EXISTS "CookingRecordAssignment_cookingRecordId_menuId_key" ON "CookingRecordAssignment" ("cookingRecordId", "menuId");

CREATE UNIQUE INDEX IF NOT EXISTS "DepartmentStockSupply_departmentId_stockSupplyId_key" ON "DepartmentStockSupply" ("departmentId", "stockSupplyId");

CREATE UNIQUE INDEX IF NOT EXISTS "OrderItem_orderId_menuId_starchId_vegetableId_key" ON "OrderItem" ("orderId", "menuId", "starchId", "vegetableId");
