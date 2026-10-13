-- Every tournament gets exactly one style (docs/adr/002-comp-styles.md).
-- The entrypoints run this file before `prisma db push`, which cannot add a required column to
-- a table with rows. It can therefore be run any number of times and does nothing once the
-- column is in place or while the table does not exist yet.
DO $$
DECLARE missing TEXT;
BEGIN
  IF to_regclass('"Tournament"') IS NULL THEN RETURN; END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'Tournament' AND column_name = 'style' AND is_nullable = 'NO'
  ) THEN RETURN; END IF;

  IF to_regtype('"CompStyle"') IS NULL THEN
    CREATE TYPE "CompStyle" AS ENUM ('TECH', 'FULLSPEED', 'DIRT', 'ICE', 'RPG', 'ENDURANCE', 'MIXED');
  END IF;
  ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "style" "CompStyle";

  -- Every TFH race is endurance, the 12h RPG ones too. An installation that never had the TFH
  -- archive gets its table only from the db push that follows.
  IF to_regclass('"TfhRace"') IS NOT NULL THEN
    UPDATE "Tournament" SET "style" = 'ENDURANCE' WHERE "style" IS NULL AND "id" IN (SELECT "tournamentId" FROM "TfhRace");
  END IF;
  -- A TFH race entered by hand, before its results are imported
  UPDATE "Tournament" SET "style" = 'ENDURANCE' WHERE "style" IS NULL AND "name" = 'TFH 24h #5';

  -- The tournaments entered by hand, as agreed
  UPDATE "Tournament" SET "style" = 'TECH' WHERE "style" IS NULL AND "name" IN ('MTS S1', 'MTS Fall 2024');
  UPDATE "Tournament" SET "style" = 'MIXED' WHERE "style" IS NULL AND "name" IN ('EMC S7', 'EMC S8', 'Omnium S1', '7CC S1', 'SMS S1', 'Vertigo S1');
  UPDATE "Tournament" SET "style" = 'RPG' WHERE "style" IS NULL AND "name" = 'Blitz League S1';

  -- A tournament this file does not know stops it, instead of getting a guessed style
  SELECT string_agg("name", ', ') INTO missing FROM "Tournament" WHERE "style" IS NULL;
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Tournaments without a style: %. Add them to prisma/migrations/20261013020000_add_comp_style/migration.sql.', missing;
  END IF;

  ALTER TABLE "Tournament" ALTER COLUMN "style" SET NOT NULL;
END $$;
