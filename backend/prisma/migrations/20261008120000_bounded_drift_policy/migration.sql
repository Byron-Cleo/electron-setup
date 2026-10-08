-- Bounded drift policy for manual shifts.
-- strictClose: manual shifts that finalize exactly at autoCloseTime (no manager step).
-- maxDriftMinutes: allowed drift past autoCloseTime before the scheduler force-closes.
--   null = unlimited (legacy behaviour, surfaced as a red flag in the UI).
ALTER TABLE "ShiftConfig" ADD COLUMN "strictClose" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ShiftConfig" ADD COLUMN "maxDriftMinutes" INTEGER;
