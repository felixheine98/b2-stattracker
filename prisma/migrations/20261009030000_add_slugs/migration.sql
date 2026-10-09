-- Matches always belong to a lineup; the one left without (an empty test match) is removed
DELETE FROM "Match" WHERE "tournamentLineupId" IS NULL;

-- CreateEnum
CREATE TYPE "SlugKind" AS ENUM ('TOURNAMENT', 'LINEUP', 'MATCH');

-- AlterTable: readable address parts, filled in by the app (lib/slugs-db.ts) on first use
ALTER TABLE "Tournament" ADD COLUMN     "slug" TEXT;
ALTER TABLE "TournamentLineup" ADD COLUMN     "slug" TEXT;
ALTER TABLE "Match" ADD COLUMN     "slug" TEXT;

-- CreateTable
CREATE TABLE "SlugAlias" (
    "id" TEXT NOT NULL,
    "kind" "SlugKind" NOT NULL,
    "scopeId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlugAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SlugAlias_kind_scopeId_slug_key" ON "SlugAlias"("kind", "scopeId", "slug");
CREATE UNIQUE INDEX "Tournament_slug_key" ON "Tournament"("slug");
CREATE UNIQUE INDEX "TournamentLineup_tournamentId_slug_key" ON "TournamentLineup"("tournamentId", "slug");
CREATE UNIQUE INDEX "Match_tournamentLineupId_slug_key" ON "Match"("tournamentLineupId", "slug");

-- A lineup with matches can no longer be deleted
ALTER TABLE "Match" DROP CONSTRAINT "Match_tournamentLineupId_fkey";
ALTER TABLE "Match" ADD CONSTRAINT "Match_tournamentLineupId_fkey" FOREIGN KEY ("tournamentLineupId") REFERENCES "TournamentLineup"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
