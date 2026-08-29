-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "unpaidAcknowledged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "unpaidAcknowledgedAt" TIMESTAMP(6) WITH TIME ZONE,
ADD COLUMN     "unpaidAcknowledgedById" UUID;

-- AlterTable
ALTER TABLE "Shift" ADD COLUMN     "declaredCash" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "declaredMpesa" DECIMAL(12,2) NOT NULL DEFAULT 0;