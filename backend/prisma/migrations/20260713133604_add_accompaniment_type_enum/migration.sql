/*
  Warnings:

  - Changed the type of `category` on the `MenuAccompaniment` table from String to enum AccompanimentType.
  - Existing string values will be cast to the enum.
  - Added the required column `mealType` to the `Order` table.
  - Added `starchId` and `vegetableId` columns to `OrderItem`.

*/

-- CreateEnum
CREATE TYPE "AccompanimentType" AS ENUM ('STARCH', 'VEGETABLE');

-- Migrate existing data: uppercase current values then cast to enum
ALTER TABLE "MenuAccompaniment" ADD COLUMN "category_tmp" "AccompanimentType";
UPDATE "MenuAccompaniment" SET "category_tmp" = UPPER("category")::"AccompanimentType";
ALTER TABLE "MenuAccompaniment" DROP COLUMN "category";
ALTER TABLE "MenuAccompaniment" RENAME COLUMN "category_tmp" TO "category";
ALTER TABLE "MenuAccompaniment" ALTER COLUMN "category" SET NOT NULL;

-- AlterTable: Order
ALTER TABLE "Order" ADD COLUMN "mealType" "ServiceTime" NOT NULL DEFAULT 'LUNCH';

-- AlterTable: OrderItem
ALTER TABLE "OrderItem" ADD COLUMN "starchId" UUID;
ALTER TABLE "OrderItem" ADD COLUMN "vegetableId" UUID;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_starchId_fkey" FOREIGN KEY ("starchId") REFERENCES "MenuAccompaniment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_vegetableId_fkey" FOREIGN KEY ("vegetableId") REFERENCES "MenuAccompaniment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
