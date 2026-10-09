-- AlterTable
ALTER TABLE "RoundResult" ADD COLUMN     "dnf" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "ecmUrl" TEXT;

-- Results imported from eCircuitMania without a time, in a round where others have one, did not finish
UPDATE "RoundResult" rr SET "dnf" = true
WHERE rr."timeMs" IS NULL
  AND EXISTS (SELECT 1 FROM "RoundResult" x WHERE x."roundId" = rr."roundId" AND x."tmId" LIKE 'ecm-%')
  AND EXISTS (SELECT 1 FROM "RoundResult" x WHERE x."roundId" = rr."roundId" AND x."timeMs" IS NOT NULL);
