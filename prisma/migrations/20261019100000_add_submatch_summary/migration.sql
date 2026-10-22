-- CreateTable
CREATE TABLE "SubMatchSummary" (
    "id" TEXT NOT NULL,
    "subMatchId" TEXT NOT NULL,
    "track" TEXT,
    "rounds" INTEGER NOT NULL,
    "roundsWon" INTEGER,
    "roundsLost" INTEGER,
    "outcome" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceImage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubMatchSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubMatchSummaryPlayer" (
    "id" TEXT NOT NULL,
    "summaryId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "rounds" INTEGER NOT NULL,
    "placementSum" INTEGER NOT NULL,

    CONSTRAINT "SubMatchSummaryPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubMatchSummary_subMatchId_key" ON "SubMatchSummary"("subMatchId");

-- CreateIndex
CREATE UNIQUE INDEX "SubMatchSummaryPlayer_summaryId_playerId_key" ON "SubMatchSummaryPlayer"("summaryId", "playerId");

-- AddForeignKey
ALTER TABLE "SubMatchSummary" ADD CONSTRAINT "SubMatchSummary_subMatchId_fkey" FOREIGN KEY ("subMatchId") REFERENCES "SubMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubMatchSummaryPlayer" ADD CONSTRAINT "SubMatchSummaryPlayer_summaryId_fkey" FOREIGN KEY ("summaryId") REFERENCES "SubMatchSummary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubMatchSummaryPlayer" ADD CONSTRAINT "SubMatchSummaryPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
