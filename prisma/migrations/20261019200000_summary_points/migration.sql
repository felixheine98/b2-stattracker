-- AlterTable
ALTER TABLE "SubMatchSummaryPlayer" ALTER COLUMN "placementSum" DROP NOT NULL,
ADD COLUMN     "points" INTEGER;
