-- CreateEnum
CREATE TYPE "StageType" AS ENUM ('SEEDING', 'GROUP', 'PLAYOFF');

-- CreateTable
CREATE TABLE "Stage" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "type" "StageType" NOT NULL,
    "number" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Stage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Stage_tournamentId_type_number_key" ON "Stage"("tournamentId", "type", "number");

-- AddForeignKey
ALTER TABLE "Stage" ADD CONSTRAINT "Stage_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "stageId" TEXT;

-- Existing tournaments get the usual stages: seeding, two match days, one day of playoffs
INSERT INTO "Stage" ("id", "tournamentId", "type", "number")
SELECT gen_random_uuid()::text, t."id", s."type"::"StageType", s."number"
FROM "Tournament" t
CROSS JOIN (VALUES ('SEEDING', 1), ('GROUP', 1), ('GROUP', 2), ('PLAYOFF', 1)) AS s("type", "number");

-- Existing matches go to the seeding or to match day 1
UPDATE "Match" m SET "stageId" = s."id"
FROM "Stage" s
WHERE s."tournamentId" = m."tournamentId" AND s."number" = 1
  AND s."type" = (CASE WHEN m."isSeeding" THEN 'SEEDING' ELSE 'GROUP' END)::"StageType";

-- AlterTable
ALTER TABLE "Match" ALTER COLUMN "stageId" SET NOT NULL,
DROP COLUMN "isSeeding";

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
