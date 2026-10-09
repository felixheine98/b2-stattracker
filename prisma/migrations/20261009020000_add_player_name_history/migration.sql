-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "initialName" TEXT;

-- The name a player has today becomes the name "from the beginning"
UPDATE "Player" SET "initialName" = "name";

-- AlterTable
ALTER TABLE "Player" ALTER COLUMN "initialName" SET NOT NULL;

-- CreateTable
CREATE TABLE "PlayerNameChange" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerNameChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlayerNameChange_playerId_effectiveFrom_key" ON "PlayerNameChange"("playerId", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "PlayerNameChange" ADD CONSTRAINT "PlayerNameChange_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
