-- CreateTable
CREATE TABLE "TfhRace" (
    "id" TEXT NOT NULL,
    "sourceEventId" INTEGER NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "mapName" TEXT,
    "tournamentId" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "TfhRace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TfhTeam" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "sourceTeamId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "checkpoints" INTEGER,
    "lastCpMs" INTEGER,
    "isB2" BOOLEAN NOT NULL DEFAULT false,
    "lineupId" TEXT,

    CONSTRAINT "TfhTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TfhDriver" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "checkpoints" INTEGER,
    "playTimeSeconds" INTEGER,
    "cpm" DOUBLE PRECISION,
    "bestLapMs" INTEGER,
    "averageLapMs" INTEGER,
    "bestSplits" INTEGER[],
    "averageSplits" INTEGER[],

    CONSTRAINT "TfhDriver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TfhFinish" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "timeMs" INTEGER,
    "sourceRank" INTEGER,
    "sourceType" INTEGER,

    CONSTRAINT "TfhFinish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TfhIdentity" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,

    CONSTRAINT "TfhIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TfhImportDraft" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "sourceEventId" INTEGER NOT NULL,
    "baseRevision" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TfhImportDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TfhRace_sourceEventId_key" ON "TfhRace"("sourceEventId");

-- CreateIndex
CREATE UNIQUE INDEX "TfhRace_tournamentId_key" ON "TfhRace"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "TfhTeam_lineupId_key" ON "TfhTeam"("lineupId");

-- CreateIndex
CREATE UNIQUE INDEX "TfhTeam_raceId_sourceTeamId_key" ON "TfhTeam"("raceId", "sourceTeamId");

-- CreateIndex
CREATE INDEX "TfhDriver_playerId_idx" ON "TfhDriver"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "TfhDriver_teamId_accountId_key" ON "TfhDriver"("teamId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "TfhFinish_driverId_number_key" ON "TfhFinish"("driverId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "TfhIdentity_raceId_accountId_key" ON "TfhIdentity"("raceId", "accountId");

-- CreateIndex
CREATE INDEX "TfhImportDraft_expiresAt_idx" ON "TfhImportDraft"("expiresAt");

-- AddForeignKey
ALTER TABLE "TfhRace" ADD CONSTRAINT "TfhRace_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TfhTeam" ADD CONSTRAINT "TfhTeam_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "TfhRace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TfhTeam" ADD CONSTRAINT "TfhTeam_lineupId_fkey" FOREIGN KEY ("lineupId") REFERENCES "TournamentLineup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TfhDriver" ADD CONSTRAINT "TfhDriver_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "TfhTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TfhDriver" ADD CONSTRAINT "TfhDriver_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TfhFinish" ADD CONSTRAINT "TfhFinish_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "TfhDriver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TfhIdentity" ADD CONSTRAINT "TfhIdentity_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "TfhRace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TfhIdentity" ADD CONSTRAINT "TfhIdentity_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
