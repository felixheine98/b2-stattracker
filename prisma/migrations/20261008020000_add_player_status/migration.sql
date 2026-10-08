-- CreateEnum
CREATE TYPE "PlayerStatus" AS ENUM ('MEMBER', 'GUEST');

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "initialStatus" "PlayerStatus" NOT NULL DEFAULT 'MEMBER';

-- CreateTable
CREATE TABLE "PlayerStatusChange" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "status" "PlayerStatus" NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerStatusChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlayerStatusChange_playerId_effectiveFrom_key" ON "PlayerStatusChange"("playerId", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "PlayerStatusChange" ADD CONSTRAINT "PlayerStatusChange_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Every tournament needs a start date: it decides whether a player counts as member or guest
UPDATE "Tournament" SET "startDate" = "createdAt" WHERE "startDate" IS NULL;
