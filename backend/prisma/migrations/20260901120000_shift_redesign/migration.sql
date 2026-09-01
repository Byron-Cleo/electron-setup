-- Step 1: Rename column
ALTER TABLE "Shift" RENAME COLUMN "date" TO "operationDay";

-- Step 2: Drop relations / FKs for removed fields (keep finalClosedById FK)
ALTER TABLE "Shift" DROP CONSTRAINT IF EXISTS "Shift_openedById_fkey";
ALTER TABLE "Shift" DROP CONSTRAINT IF EXISTS "Shift_closedById_fkey";

-- Step 3: Drop removed columns
ALTER TABLE "Shift" DROP COLUMN IF EXISTS "actualOpeningTime";
ALTER TABLE "Shift" DROP COLUMN IF EXISTS "actualCloseTime";
ALTER TABLE "Shift" DROP COLUMN IF EXISTS "openedById";
ALTER TABLE "Shift" DROP COLUMN IF EXISTS "closedById";

-- Step 4: Update unique constraint
ALTER TABLE "Shift" DROP CONSTRAINT IF EXISTS "Shift_type_date_key";
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_type_operationDay_key" UNIQUE ("type", "operationDay");
