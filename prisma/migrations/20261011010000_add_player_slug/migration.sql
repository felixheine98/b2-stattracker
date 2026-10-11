-- AlterEnum
ALTER TYPE "SlugKind" ADD VALUE 'PLAYER';

-- AlterTable
ALTER TABLE "Player" ADD COLUMN "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Player_slug_key" ON "Player"("slug");
