ALTER TABLE "Player" ADD COLUMN "discordUserId" TEXT;
CREATE UNIQUE INDEX "Player_discordUserId_key" ON "Player"("discordUserId");
ALTER TABLE "Planning" ADD COLUMN "discordSettings" JSONB;
