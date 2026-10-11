-- CreateTable
CREATE TABLE "PlanningVariant" (
    "id" TEXT NOT NULL,
    "planningId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanningVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningVariantLineup" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanningVariantLineup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningVariantSlot" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "lineupId" TEXT,
    "playerId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanningVariantSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningVote" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "PlanningVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanningVariantSlot_variantId_playerId_key" ON "PlanningVariantSlot"("variantId", "playerId");
CREATE UNIQUE INDEX "PlanningVote_variantId_userId_key" ON "PlanningVote"("variantId", "userId");

-- AddForeignKey
ALTER TABLE "PlanningVariant" ADD CONSTRAINT "PlanningVariant_planningId_fkey" FOREIGN KEY ("planningId") REFERENCES "Planning"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanningVariantLineup" ADD CONSTRAINT "PlanningVariantLineup_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "PlanningVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanningVariantSlot" ADD CONSTRAINT "PlanningVariantSlot_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "PlanningVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanningVariantSlot" ADD CONSTRAINT "PlanningVariantSlot_lineupId_fkey" FOREIGN KEY ("lineupId") REFERENCES "PlanningVariantLineup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlanningVariantSlot" ADD CONSTRAINT "PlanningVariantSlot_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanningVote" ADD CONSTRAINT "PlanningVote_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "PlanningVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanningVote" ADD CONSTRAINT "PlanningVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
