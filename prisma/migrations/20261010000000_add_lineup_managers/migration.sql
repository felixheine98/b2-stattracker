-- CreateTable
CREATE TABLE "TournamentLineupManager" (
    "id" TEXT NOT NULL,
    "lineupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentLineupManager_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TournamentLineupManager_lineupId_userId_key" ON "TournamentLineupManager"("lineupId", "userId");

-- AddForeignKey
ALTER TABLE "TournamentLineupManager" ADD CONSTRAINT "TournamentLineupManager_lineupId_fkey" FOREIGN KEY ("lineupId") REFERENCES "TournamentLineup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentLineupManager" ADD CONSTRAINT "TournamentLineupManager_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
