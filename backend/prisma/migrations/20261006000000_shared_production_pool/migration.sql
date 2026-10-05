-- Dual-engine production pools: SHARED (whole pool, no allocation) vs
-- ALLOCATED (today's hard-cap split), plus weighted consumption so fractional
-- servings deduct correctly and pools survive shift boundaries.

-- CreateEnum
CREATE TYPE "SellingMode" AS ENUM ('ALLOCATED', 'SHARED');

-- AlterEnum: MenuAccompaniment gains PORTION (Fried Eggs 1pc / 2pc reuses the
-- accompaniment convention rather than a new table)
ALTER TYPE "AccompanimentType" ADD VALUE 'PORTION';

-- AlterTable (StockSupply — default engine for future batches)
ALTER TABLE "StockSupply" ADD COLUMN "sellingMode" "SellingMode" NOT NULL DEFAULT 'ALLOCATED';

-- AlterTable (CookingRecord — engine frozen at cook time + disposal accounting)
ALTER TABLE "CookingRecord" ADD COLUMN "sellingMode" "SellingMode" NOT NULL DEFAULT 'ALLOCATED',
ADD COLUMN "wastedPlates" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable (StockSupplyMenu — per-(supply,dish) consumption rate)
ALTER TABLE "StockSupplyMenu" ADD COLUMN "platesPerServing" DECIMAL(12,2) NOT NULL DEFAULT 1;

-- AlterTable (Menu — Decimal stock, portion slot, per-dish default quantity)
ALTER TABLE "Menu" ALTER COLUMN "stock" SET DATA TYPE DECIMAL(12,2) USING "stock"::DECIMAL(12,2);
ALTER TABLE "Menu" ALTER COLUMN "stock" SET DEFAULT 0;
ALTER TABLE "Menu" ADD COLUMN "hasPortion" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "portionId" UUID,
ADD COLUMN "defaultQty" INTEGER NOT NULL DEFAULT 1;

-- AlterTable (MenuAccompaniment — PORTION consumption rate + per-dish ownership)
ALTER TABLE "MenuAccompaniment" ADD COLUMN "platesPerServing" DECIMAL(12,2) NOT NULL DEFAULT 1;
-- PORTION rows are owned by their dish so one dish can offer many options
-- (Fried Eggs = 1pc / 2pc); a single Menu.portionId pointer cannot express that.
-- STARCH/VEGETABLE rows stay global with this left NULL.
ALTER TABLE "MenuAccompaniment" ADD COLUMN "menuId" UUID;

-- AlterTable (OrderItem — portion joins the line identity)
ALTER TABLE "OrderItem" ADD COLUMN "portionId" UUID;

-- AlterTable (ShiftSnapshot — Int -> Decimal(12,2))
-- A weighted supply leaves a fractional pool (Boiled Meat: 20 - 0.5 = 19.5).
-- An Int column truncates that to 19 at every snapshot, and the error compounds
-- across shifts, so carry-over and opening stock would drift permanently.
ALTER TABLE "ShiftSnapshot" ALTER COLUMN "openingPlates" SET DATA TYPE DECIMAL(12,2) USING "openingPlates"::DECIMAL(12,2);
ALTER TABLE "ShiftSnapshot" ALTER COLUMN "openingPlates" SET DEFAULT 0;
ALTER TABLE "ShiftSnapshot" ALTER COLUMN "platesSold" SET DATA TYPE DECIMAL(12,2) USING "platesSold"::DECIMAL(12,2);
ALTER TABLE "ShiftSnapshot" ALTER COLUMN "platesSold" SET DEFAULT 0;
ALTER TABLE "ShiftSnapshot" ALTER COLUMN "closingStockAtAutoClose" SET DATA TYPE DECIMAL(12,2) USING "closingStockAtAutoClose"::DECIMAL(12,2);
ALTER TABLE "ShiftSnapshot" ALTER COLUMN "closingStockAtManualClose" SET DATA TYPE DECIMAL(12,2) USING "closingStockAtManualClose"::DECIMAL(12,2);
ALTER TABLE "ShiftSnapshot" ALTER COLUMN "platesSoldAtAutoClose" SET DATA TYPE DECIMAL(12,2) USING "platesSoldAtAutoClose"::DECIMAL(12,2);
ALTER TABLE "ShiftSnapshot" ALTER COLUMN "driftPlates" SET DATA TYPE DECIMAL(12,2) USING "driftPlates"::DECIMAL(12,2);
ALTER TABLE "ShiftSnapshot" ALTER COLUMN "platesWasted" SET DATA TYPE DECIMAL(12,2) USING "platesWasted"::DECIMAL(12,2);
ALTER TABLE "ShiftSnapshot" ALTER COLUMN "platesWasted" SET DEFAULT 0;
-- Reports use this to avoid summing one shared pool across mirrored dishes.
ALTER TABLE "ShiftSnapshot" ADD COLUMN "sellingMode" "SellingMode" NOT NULL DEFAULT 'ALLOCATED';

-- DropIndex + CreateIndex (OrderItem uniqueness must include portionId, or two
-- lines for the same dish with different portions would collide)
DROP INDEX IF EXISTS "orderitems_order_menu_starch_veg_key";
CREATE UNIQUE INDEX "orderitems_order_menu_starch_veg_portion_key" ON "OrderItem"("orderId", "menuId", "starchId", "vegetableId", "portionId");

-- CreateIndex (pool derivation reads allocations per batch)
CREATE INDEX "OrderItemAllocation_cookingRecordId_idx" ON "OrderItemAllocation"("cookingRecordId");

-- AddForeignKey (MenuAccompaniment -> Menu, portion ownership)
ALTER TABLE "MenuAccompaniment" ADD CONSTRAINT "MenuAccompaniment_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey (Menu -> MenuAccompaniment portion)
ALTER TABLE "Menu" ADD CONSTRAINT "Menu_portionId_fkey" FOREIGN KEY ("portionId") REFERENCES "MenuAccompaniment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey (OrderItem -> MenuAccompaniment portion)
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_portionId_fkey" FOREIGN KEY ("portionId") REFERENCES "MenuAccompaniment"("id") ON DELETE SET NULL ON UPDATE CASCADE;