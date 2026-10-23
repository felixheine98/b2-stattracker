-- AlterTable
ALTER TABLE "TournamentLineup" ADD COLUMN "discordChannelId" TEXT;

-- AlterTable
ALTER TABLE "MatchdayPlan" ADD COLUMN "discordSettings" JSONB;
