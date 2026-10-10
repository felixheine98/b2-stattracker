BEGIN;

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "isOpponentOnly" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "confirmedOutcome" TEXT,
ADD COLUMN     "opponentLineupId" TEXT,
ADD COLUMN     "resultRevision" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "OpponentTeam" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "logo" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "source" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpponentTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpponentLineup" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "teamId" TEXT,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "logo" TEXT,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "previousId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpponentLineup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpponentTeamSlot" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,

    CONSTRAINT "OpponentTeamSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpponentLineupSlot" (
    "id" TEXT NOT NULL,
    "lineupId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,

    CONSTRAINT "OpponentLineupSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpponentIdentity" (
    "id" TEXT NOT NULL,
    "lineupId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,

    CONSTRAINT "OpponentIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchConfirmation" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OpponentLineup_tournamentId_nameKey_key" ON "OpponentLineup"("tournamentId", "nameKey");

-- CreateIndex
CREATE UNIQUE INDEX "OpponentTeamSlot_teamId_playerId_key" ON "OpponentTeamSlot"("teamId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "OpponentLineupSlot_lineupId_playerId_key" ON "OpponentLineupSlot"("lineupId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "OpponentIdentity_lineupId_sourceId_key" ON "OpponentIdentity"("lineupId", "sourceId");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_opponentLineupId_fkey" FOREIGN KEY ("opponentLineupId") REFERENCES "OpponentLineup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpponentLineup" ADD CONSTRAINT "OpponentLineup_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpponentLineup" ADD CONSTRAINT "OpponentLineup_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "OpponentTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpponentLineup" ADD CONSTRAINT "OpponentLineup_previousId_fkey" FOREIGN KEY ("previousId") REFERENCES "OpponentLineup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpponentTeamSlot" ADD CONSTRAINT "OpponentTeamSlot_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "OpponentTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpponentTeamSlot" ADD CONSTRAINT "OpponentTeamSlot_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpponentLineupSlot" ADD CONSTRAINT "OpponentLineupSlot_lineupId_fkey" FOREIGN KEY ("lineupId") REFERENCES "OpponentLineup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpponentLineupSlot" ADD CONSTRAINT "OpponentLineupSlot_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpponentIdentity" ADD CONSTRAINT "OpponentIdentity_lineupId_fkey" FOREIGN KEY ("lineupId") REFERENCES "OpponentLineup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpponentIdentity" ADD CONSTRAINT "OpponentIdentity_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchConfirmation" ADD CONSTRAINT "MatchConfirmation_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Existing free-text opponents become separate competition entries, not global teams.
INSERT INTO "OpponentLineup" ("id", "tournamentId", "name", "nameKey", "updatedAt")
SELECT 'legacy-opp-' || md5("tournamentId" || ':' || lower(regexp_replace(btrim("opponent"), '\s+', ' ', 'g'))),
       "tournamentId", min(btrim("opponent")), lower(regexp_replace(btrim("opponent"), '\s+', ' ', 'g')), CURRENT_TIMESTAMP
FROM "Match" WHERE "opponent" IS NOT NULL AND btrim("opponent") <> ''
GROUP BY "tournamentId", lower(regexp_replace(btrim("opponent"), '\s+', ' ', 'g'));
UPDATE "Match" m SET "opponentLineupId" = l."id"
FROM "OpponentLineup" l
WHERE m."tournamentId" = l."tournamentId"
AND lower(regexp_replace(btrim(m."opponent"), '\s+', ' ', 'g')) = l."nameKey";

-- Confirmed UUIDs reuse the same person as our own members/guests.
INSERT INTO "Player" ("id", "tmId", "name", "initialName", "isOpponentOnly", "updatedAt")
SELECT DISTINCT ON (lower(r."tmId")) 'opp-person-' || md5(lower(r."tmId")), lower(r."tmId"), r."playerName", r."playerName", true, CURRENT_TIMESTAMP
FROM "RoundResult" r
WHERE NOT r."isOurTeam" AND r."tmId" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
ORDER BY lower(r."tmId"), r."id"
ON CONFLICT ("tmId") DO NOTHING;
UPDATE "RoundResult" r SET "playerId" = p."id", "tmId" = p."tmId"
FROM "Player" p WHERE NOT r."isOurTeam" AND lower(r."tmId") = p."tmId";

-- Name-only results are scoped to their competition lineup; anonymous placements stay anonymous.
INSERT INTO "Player" ("id", "tmId", "name", "initialName", "isOpponentOnly", "updatedAt")
SELECT DISTINCT ON (m."opponentLineupId", r."tmId")
 'opp-name-' || md5(m."opponentLineupId" || ':' || r."tmId"),
 'unknown-' || md5(m."opponentLineupId" || ':' || r."tmId"), r."playerName", r."playerName", true, CURRENT_TIMESTAMP
FROM "RoundResult" r JOIN "Round" ro ON ro."id" = r."roundId"
JOIN "SubMatch" sm ON sm."id" = ro."subMatchId" JOIN "Match" m ON m."id" = sm."matchId"
WHERE NOT r."isOurTeam" AND r."tmId" LIKE 'ecm-%' AND m."opponentLineupId" IS NOT NULL
ORDER BY m."opponentLineupId", r."tmId", r."id";
INSERT INTO "OpponentIdentity" ("id", "lineupId", "sourceId", "playerId")
SELECT DISTINCT 'opp-identity-' || md5(m."opponentLineupId" || ':' || r."tmId"),
 m."opponentLineupId", r."tmId", 'opp-name-' || md5(m."opponentLineupId" || ':' || r."tmId")
FROM "RoundResult" r JOIN "Round" ro ON ro."id" = r."roundId"
JOIN "SubMatch" sm ON sm."id" = ro."subMatchId" JOIN "Match" m ON m."id" = sm."matchId"
WHERE NOT r."isOurTeam" AND r."tmId" LIKE 'ecm-%' AND m."opponentLineupId" IS NOT NULL;
UPDATE "RoundResult" r SET "playerId" = i."playerId"
FROM "OpponentIdentity" i, "Round" ro, "SubMatch" sm, "Match" m
WHERE NOT r."isOurTeam" AND r."tmId" = i."sourceId"
AND r."roundId" = ro."id" AND ro."subMatchId" = sm."id" AND sm."matchId" = m."id"
AND m."opponentLineupId" = i."lineupId";

ALTER TABLE "Match" ADD CONSTRAINT "Match_confirmedOutcome_check"
CHECK (("closedAt" IS NULL AND "confirmedOutcome" IS NULL) OR ("closedAt" IS NOT NULL AND "confirmedOutcome" IN ('W', 'L', 'D')));

COMMIT;
