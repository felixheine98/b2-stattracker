-- AlterTable
ALTER TABLE "Match" ADD COLUMN "tournamentLineupId" TEXT;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_tournamentLineupId_fkey" FOREIGN KEY ("tournamentLineupId") REFERENCES "TournamentLineup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
