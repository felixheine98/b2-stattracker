-- AlterTable
ALTER TABLE "Planning" ADD COLUMN "adoptedVariantId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Planning_adoptedVariantId_key" ON "Planning"("adoptedVariantId");

-- AddForeignKey
ALTER TABLE "Planning" ADD CONSTRAINT "Planning_adoptedVariantId_fkey" FOREIGN KEY ("adoptedVariantId") REFERENCES "PlanningVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
