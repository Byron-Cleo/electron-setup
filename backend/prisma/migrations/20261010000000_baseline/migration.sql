-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ServiceTime" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'DESSERT', 'BEVERAGE');

-- CreateEnum
CREATE TYPE "AccompanimentType" AS ENUM ('STARCH', 'VEGETABLE', 'PORTION');

-- CreateEnum
CREATE TYPE "SellingMode" AS ENUM ('ALLOCATED', 'SHARED');

-- CreateEnum
CREATE TYPE "ItemUnit" AS ENUM ('KG', 'PKT', 'L', 'ML', 'PCS');

-- CreateEnum
CREATE TYPE "StockRequestStatus" AS ENUM ('PENDING', 'PARTIAL', 'COMPLETED');

-- CreateTable
CREATE TABLE "Account" (
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("provider","providerAccountId")
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID,
    "sessionCartId" TEXT NOT NULL,
    "items" JSON[] DEFAULT ARRAY[]::JSON[],
    "itemsPrice" DECIMAL(12,2) NOT NULL,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "shippingPrice" DECIMAL(12,2) NOT NULL,
    "taxPrice" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Menu" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "images" TEXT[],
    "stock" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "numReviews" INTEGER NOT NULL DEFAULT 0,
    "banner" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hasStarch" BOOLEAN NOT NULL DEFAULT false,
    "hasVegetable" BOOLEAN NOT NULL DEFAULT false,
    "starchId" UUID,
    "vegetableId" UUID,
    "hasPortion" BOOLEAN NOT NULL DEFAULT false,
    "portionId" UUID,
    "defaultQty" INTEGER NOT NULL DEFAULT 1,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Menu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuAccompaniment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(12,2),
    "image" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "category" "AccompanimentType" NOT NULL,
    "platesPerServing" DECIMAL(12,2) NOT NULL DEFAULT 1,
    "menuId" UUID,

    CONSTRAINT "MenuAccompaniment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orderNumber" SERIAL NOT NULL,
    "userId" UUID NOT NULL,
    "shippingAddress" JSON NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "paymentResult" JSON,
    "itemsPrice" DECIMAL(12,2) NOT NULL,
    "shippingPrice" DECIMAL(12,2) NOT NULL,
    "taxPrice" DECIMAL(12,2) NOT NULL,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMPTZ(6),
    "isDelivered" BOOLEAN NOT NULL DEFAULT false,
    "deliveredAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mealType" "ServiceTime" NOT NULL,
    "shiftId" UUID NOT NULL,
    "isVoid" BOOLEAN NOT NULL DEFAULT false,
    "voidReason" TEXT,
    "voidedAt" TIMESTAMPTZ(6),
    "voidedById" UUID,
    "voidedOrderId" UUID,
    "paymentType" TEXT,
    "batchId" TEXT,
    "mpesaAmount" DECIMAL(12,2),
    "cashAmount" DECIMAL(12,2),
    "unpaidAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "unpaidAcknowledgedById" UUID,
    "unpaidAcknowledgedAt" TIMESTAMPTZ(6),
    "customerId" UUID,
    "customerAssignedById" UUID,
    "customerAssignedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orderId" UUID NOT NULL,
    "menuId" UUID NOT NULL,
    "qty" INTEGER NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "starchId" UUID,
    "vegetableId" UUID,
    "portionId" UUID,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "menuId" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isVerifiedPurchase" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "sessionToken" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "expires" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("sessionToken")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL DEFAULT 'NO_NAME',
    "email" TEXT,
    "emailVerified" TIMESTAMPTZ(6),
    "image" TEXT,
    "password" TEXT,
    "pin" TEXT,
    "pinLookup" TEXT,
    "role" TEXT NOT NULL DEFAULT 'staff',
    "roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "platform" TEXT,
    "address" JSON,
    "paymentMethod" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("identifier","token")
);

-- CreateTable
CREATE TABLE "MenuMealType" (
    "menuId" UUID NOT NULL,
    "mealType" "ServiceTime" NOT NULL,

    CONSTRAINT "MenuMealType_pkey" PRIMARY KEY ("menuId","mealType")
);

-- CreateTable
CREATE TABLE "StockSupply" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "unit" "ItemUnit" NOT NULL,
    "currentStock" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "reorderLevel" DECIMAL(12,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "platesPerUnit" DECIMAL(12,2),
    "image" TEXT,
    "isMenuStock" BOOLEAN NOT NULL DEFAULT false,
    "costPrice" DECIMAL(12,2),
    "sellingMode" "SellingMode" NOT NULL DEFAULT 'ALLOCATED',

    CONSTRAINT "StockSupply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockRequest" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "requestedById" UUID NOT NULL,
    "department" TEXT NOT NULL,
    "status" "StockRequestStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StockRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockRequestItem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "stockRequestId" UUID NOT NULL,
    "stockSupplyId" UUID NOT NULL,
    "quantityRequested" DECIMAL(12,2) NOT NULL,
    "quantityDelivered" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StockRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentStockSupply" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "departmentId" UUID NOT NULL,
    "stockSupplyId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepartmentStockSupply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockFulfillment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "stockRequestId" UUID NOT NULL,
    "fulfilledById" UUID NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockFulfillment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockFulfillmentItem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "stockFulfillmentId" UUID NOT NULL,
    "stockRequestItemId" UUID NOT NULL,
    "quantityDelivered" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockFulfillmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockReturn" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "stockSupplyId" UUID NOT NULL,
    "stockRequestItemId" UUID,
    "quantityReturned" DECIMAL(12,2) NOT NULL,
    "returnedById" UUID NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CookingRecord" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "stockSupplyId" UUID NOT NULL,
    "quantityCooked" DECIMAL(12,2) NOT NULL,
    "platesExpected" DECIMAL(12,2) NOT NULL,
    "cookedById" UUID NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cookedDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "platesActual" DECIMAL(12,2),
    "disposed" BOOLEAN NOT NULL DEFAULT false,
    "disposedAt" TIMESTAMPTZ(3),
    "shiftId" UUID,
    "batchNumber" INTEGER,
    "sellingMode" "SellingMode" NOT NULL DEFAULT 'ALLOCATED',
    "wastedPlates" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "CookingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CookingRecordAssignment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cookingRecordId" UUID NOT NULL,
    "menuId" UUID NOT NULL,
    "quantityPlates" DECIMAL(12,2) NOT NULL,
    "platesRemaining" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CookingRecordAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItemAllocation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orderItemId" UUID NOT NULL,
    "cookingRecordId" UUID NOT NULL,
    "cookingRecordMenuId" UUID,
    "plates" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItemAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockSupplyMenu" (
    "stockSupplyId" UUID NOT NULL,
    "menuId" UUID NOT NULL,
    "platesPerServing" DECIMAL(12,2) NOT NULL DEFAULT 1,
    "excludedFromSharedPool" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "StockSupplyMenu_pkey" PRIMARY KEY ("stockSupplyId","menuId")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" TEXT NOT NULL,
    "operationDay" DATE NOT NULL,
    "autoOpenTime" TIMESTAMPTZ(3) NOT NULL,
    "autoCloseTime" TIMESTAMPTZ(3) NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "autoClosed" BOOLEAN NOT NULL DEFAULT false,
    "autoClosedAt" TIMESTAMPTZ(6),
    "finalClosedAt" TIMESTAMPTZ(6),
    "finalCloseSource" TEXT,
    "finalClosedById" UUID,
    "declaredCash" DECIMAL(12,2),
    "declaredMpesa" DECIMAL(12,2),

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftSnapshot" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shiftId" UUID NOT NULL,
    "menuId" UUID NOT NULL,
    "openingPlates" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "platesSold" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "closingStockAtAutoClose" DECIMAL(12,2),
    "autoCloseTime" TIMESTAMPTZ(6),
    "manualCloseTime" TIMESTAMPTZ(6),
    "closingStockAtManualClose" DECIMAL(12,2),
    "platesSoldAtAutoClose" DECIMAL(12,2),
    "driftPlates" DECIMAL(12,2),
    "driftMinutes" INTEGER,
    "platesWasted" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sellingMode" "SellingMode" NOT NULL DEFAULT 'ALLOCATED',

    CONSTRAINT "ShiftSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftConfig" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" TEXT NOT NULL,
    "autoOpenTime" TEXT NOT NULL,
    "autoCloseTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "manual" BOOLEAN NOT NULL DEFAULT false,
    "strictClose" BOOLEAN NOT NULL DEFAULT false,
    "maxDriftMinutes" INTEGER,
    "anchorIntervalMinutes" INTEGER NOT NULL DEFAULT 1440,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ShiftConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_slug_idx" ON "Menu"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "orderitems_order_menu_starch_veg_portion_key" ON "OrderItem"("orderId", "menuId", "starchId", "vegetableId", "portionId");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_pin_lookup_idx" ON "User"("pinLookup");

-- CreateIndex
CREATE UNIQUE INDEX "StockSupply_slug_key" ON "StockSupply"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentStockSupply_departmentId_stockSupplyId_key" ON "DepartmentStockSupply"("departmentId", "stockSupplyId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "Customer_name_idx" ON "Customer"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CookingRecord_stockSupplyId_shiftId_batchNumber_key" ON "CookingRecord"("stockSupplyId", "shiftId", "batchNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CookingRecordAssignment_cookingRecordId_menuId_key" ON "CookingRecordAssignment"("cookingRecordId", "menuId");

-- CreateIndex
CREATE INDEX "OrderItemAllocation_cookingRecordId_idx" ON "OrderItemAllocation"("cookingRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "Shift_type_operationDay_key" ON "Shift"("type", "operationDay");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftSnapshot_shiftId_menuId_key" ON "ShiftSnapshot"("shiftId", "menuId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Menu" ADD CONSTRAINT "Menu_starchId_fkey" FOREIGN KEY ("starchId") REFERENCES "MenuAccompaniment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Menu" ADD CONSTRAINT "Menu_vegetableId_fkey" FOREIGN KEY ("vegetableId") REFERENCES "MenuAccompaniment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Menu" ADD CONSTRAINT "Menu_portionId_fkey" FOREIGN KEY ("portionId") REFERENCES "MenuAccompaniment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuAccompaniment" ADD CONSTRAINT "MenuAccompaniment_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_voidedOrderId_fkey" FOREIGN KEY ("voidedOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_starchId_fkey" FOREIGN KEY ("starchId") REFERENCES "MenuAccompaniment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_vegetableId_fkey" FOREIGN KEY ("vegetableId") REFERENCES "MenuAccompaniment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_portionId_fkey" FOREIGN KEY ("portionId") REFERENCES "MenuAccompaniment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuMealType" ADD CONSTRAINT "MenuMealType_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockRequest" ADD CONSTRAINT "StockRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockRequestItem" ADD CONSTRAINT "StockRequestItem_stockRequestId_fkey" FOREIGN KEY ("stockRequestId") REFERENCES "StockRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockRequestItem" ADD CONSTRAINT "StockRequestItem_stockSupplyId_fkey" FOREIGN KEY ("stockSupplyId") REFERENCES "StockSupply"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentStockSupply" ADD CONSTRAINT "DepartmentStockSupply_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentStockSupply" ADD CONSTRAINT "DepartmentStockSupply_stockSupplyId_fkey" FOREIGN KEY ("stockSupplyId") REFERENCES "StockSupply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockFulfillment" ADD CONSTRAINT "StockFulfillment_fulfilledById_fkey" FOREIGN KEY ("fulfilledById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockFulfillment" ADD CONSTRAINT "StockFulfillment_stockRequestId_fkey" FOREIGN KEY ("stockRequestId") REFERENCES "StockRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockFulfillmentItem" ADD CONSTRAINT "StockFulfillmentItem_stockFulfillmentId_fkey" FOREIGN KEY ("stockFulfillmentId") REFERENCES "StockFulfillment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockFulfillmentItem" ADD CONSTRAINT "StockFulfillmentItem_stockRequestItemId_fkey" FOREIGN KEY ("stockRequestItemId") REFERENCES "StockRequestItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReturn" ADD CONSTRAINT "StockReturn_stockSupplyId_fkey" FOREIGN KEY ("stockSupplyId") REFERENCES "StockSupply"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReturn" ADD CONSTRAINT "StockReturn_stockRequestItemId_fkey" FOREIGN KEY ("stockRequestItemId") REFERENCES "StockRequestItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReturn" ADD CONSTRAINT "StockReturn_returnedById_fkey" FOREIGN KEY ("returnedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CookingRecord" ADD CONSTRAINT "CookingRecord_cookedById_fkey" FOREIGN KEY ("cookedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CookingRecord" ADD CONSTRAINT "CookingRecord_stockSupplyId_fkey" FOREIGN KEY ("stockSupplyId") REFERENCES "StockSupply"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CookingRecord" ADD CONSTRAINT "CookingRecord_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CookingRecordAssignment" ADD CONSTRAINT "CookingRecordAssignment_cookingRecordId_fkey" FOREIGN KEY ("cookingRecordId") REFERENCES "CookingRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CookingRecordAssignment" ADD CONSTRAINT "CookingRecordAssignment_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemAllocation" ADD CONSTRAINT "OrderItemAllocation_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemAllocation" ADD CONSTRAINT "OrderItemAllocation_cookingRecordId_fkey" FOREIGN KEY ("cookingRecordId") REFERENCES "CookingRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemAllocation" ADD CONSTRAINT "OrderItemAllocation_cookingRecordMenuId_fkey" FOREIGN KEY ("cookingRecordMenuId") REFERENCES "CookingRecordAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockSupplyMenu" ADD CONSTRAINT "StockSupplyMenu_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockSupplyMenu" ADD CONSTRAINT "StockSupplyMenu_stockSupplyId_fkey" FOREIGN KEY ("stockSupplyId") REFERENCES "StockSupply"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_finalClosedById_fkey" FOREIGN KEY ("finalClosedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftSnapshot" ADD CONSTRAINT "ShiftSnapshot_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftSnapshot" ADD CONSTRAINT "ShiftSnapshot_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

