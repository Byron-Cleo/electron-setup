-- Stock returns: the corrective ledger for uncooked stock handed back to the
-- store — either directly from the Kitchen Production remainder or implicitly
-- when a request's amount is adjusted below what was already delivered.

-- CreateTable
CREATE TABLE "StockReturn" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "stockSupplyId" UUID NOT NULL,
    "stockRequestItemId" UUID,
    "quantityReturned" DECIMAL(12,2) NOT NULL,
    "returnedById" UUID NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

    CONSTRAINT "StockReturn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockReturn_stockSupplyId_idx" ON "StockReturn"("stockSupplyId");
CREATE INDEX "StockReturn_stockRequestItemId_idx" ON "StockReturn"("stockRequestItemId");
CREATE INDEX "StockReturn_returnedById_idx" ON "StockReturn"("returnedById");

-- AddForeignKey
ALTER TABLE "StockReturn" ADD CONSTRAINT "StockReturn_stockSupplyId_fkey" FOREIGN KEY ("stockSupplyId") REFERENCES "StockSupply"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockReturn" ADD CONSTRAINT "StockReturn_stockRequestItemId_fkey" FOREIGN KEY ("stockRequestItemId") REFERENCES "StockRequestItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockReturn" ADD CONSTRAINT "StockReturn_returnedById_fkey" FOREIGN KEY ("returnedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
