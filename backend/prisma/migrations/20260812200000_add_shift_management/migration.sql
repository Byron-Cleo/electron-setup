-- CreateEnum
CREATE TYPE "ShiftType" AS ENUM ('DAY', 'NIGHT');

-- AlterTable: Order
ALTER TABLE "Order" ADD COLUMN "shiftId" UUID,
ADD COLUMN "isVoid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "voidReason" TEXT,
ADD COLUMN "voidedAt" TIMESTAMP(6),
ADD COLUMN "voidedById" UUID,
ADD COLUMN "voidedOrderId" UUID;

-- AlterTable: StockSupply
ALTER TABLE "StockSupply" ADD COLUMN "costPrice" DECIMAL(12,2);

-- CreateTable: Shift
CREATE TABLE "Shift" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "ShiftType" NOT NULL,
    "date" DATE NOT NULL,
    "openingTime" TIMESTAMP(3) NOT NULL,
    "autoCloseTime" TIMESTAMP(3) NOT NULL,
    "actualCloseTime" TIMESTAMP(6),
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "openedById" UUID NOT NULL,
    "closedById" UUID,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ShiftSnapshot
CREATE TABLE "ShiftSnapshot" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shiftId" UUID NOT NULL,
    "menuId" UUID NOT NULL,
    "openingPlates" INTEGER NOT NULL,
    "closingPlates" INTEGER,
    "platesSold" INTEGER NOT NULL DEFAULT 0,
    "platesWasted" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ShiftSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shift_type_date_key" ON "Shift"("type", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftSnapshot_shiftId_menuId_key" ON "ShiftSnapshot"("shiftId", "menuId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_voidedOrderId_fkey" FOREIGN KEY ("voidedOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftSnapshot" ADD CONSTRAINT "ShiftSnapshot_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftSnapshot" ADD CONSTRAINT "ShiftSnapshot_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
