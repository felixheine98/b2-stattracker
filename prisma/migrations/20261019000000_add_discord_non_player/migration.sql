CREATE TABLE "DiscordNonPlayer" (
    "discordUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiscordNonPlayer_pkey" PRIMARY KEY ("discordUserId")
);
