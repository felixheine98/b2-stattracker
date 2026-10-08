-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "dismissedTmioCountry" TEXT,
ADD COLUMN     "dismissedTmioName" TEXT,
ADD COLUMN     "tmioCheckedAt" TIMESTAMP(3),
ADD COLUMN     "tmioCountry" TEXT,
ADD COLUMN     "tmioName" TEXT;
