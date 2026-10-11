-- CreateEnum
CREATE TYPE "Availability" AS ENUM ('FIX', 'MAYBE', 'OUT');

-- CreateTable
CREATE TABLE "Planning" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Planning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningLevel" (
    "id" TEXT NOT NULL,
    "planningId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanningLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningEntry" (
    "id" TEXT NOT NULL,
    "planningId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "status" "Availability",
    "levelId" TEXT,
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanningEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Planning_tournamentId_key" ON "Planning"("tournamentId");
CREATE UNIQUE INDEX "PlanningLevel_planningId_name_key" ON "PlanningLevel"("planningId", "name");
CREATE UNIQUE INDEX "PlanningEntry_planningId_playerId_key" ON "PlanningEntry"("planningId", "playerId");

-- AddForeignKey
ALTER TABLE "Planning" ADD CONSTRAINT "Planning_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanningLevel" ADD CONSTRAINT "PlanningLevel_planningId_fkey" FOREIGN KEY ("planningId") REFERENCES "Planning"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanningEntry" ADD CONSTRAINT "PlanningEntry_planningId_fkey" FOREIGN KEY ("planningId") REFERENCES "Planning"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanningEntry" ADD CONSTRAINT "PlanningEntry_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanningEntry" ADD CONSTRAINT "PlanningEntry_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "PlanningLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
