-- AlterTable
ALTER TABLE "RoundResult" ALTER COLUMN "timeMs" DROP NOT NULL,
ADD COLUMN     "position" INTEGER;
