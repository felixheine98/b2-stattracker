-- CreateEnum
CREATE TYPE "MatchdayAnswer" AS ENUM ('FIX', 'PARTIAL', 'MAYBE', 'OUT');

-- CreateTable
CREATE TABLE "MatchdayPlan" (
    "id" TEXT NOT NULL,
    "lineupId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "published" JSONB,
    "publishedVariantId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchdayPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchdayPlanAnswer" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "answer" "MatchdayAnswer",
    "note" TEXT,
    "answeredAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchdayPlanAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchdayPlanAbsence" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,

    CONSTRAINT "MatchdayPlanAbsence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchdayVariant" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "seats" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchdayVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchdayPlan_lineupId_stageId_key" ON "MatchdayPlan"("lineupId", "stageId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchdayPlanAnswer_planId_playerId_key" ON "MatchdayPlanAnswer"("planId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchdayPlanAbsence_planId_playerId_matchId_key" ON "MatchdayPlanAbsence"("planId", "playerId", "matchId");

-- AddForeignKey
ALTER TABLE "MatchdayPlan" ADD CONSTRAINT "MatchdayPlan_lineupId_fkey" FOREIGN KEY ("lineupId") REFERENCES "TournamentLineup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchdayPlan" ADD CONSTRAINT "MatchdayPlan_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchdayPlanAnswer" ADD CONSTRAINT "MatchdayPlanAnswer_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MatchdayPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchdayPlanAnswer" ADD CONSTRAINT "MatchdayPlanAnswer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchdayPlanAbsence" ADD CONSTRAINT "MatchdayPlanAbsence_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MatchdayPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchdayPlanAbsence" ADD CONSTRAINT "MatchdayPlanAbsence_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchdayPlanAbsence" ADD CONSTRAINT "MatchdayPlanAbsence_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchdayVariant" ADD CONSTRAINT "MatchdayVariant_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MatchdayPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

