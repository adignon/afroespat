-- ═══════════════════════════════════════════════════════════════════════════
-- FUSION DES DEUX ENUMS D'ENTRAIDE — SECONDE MOITIÉ : LA COLONNE
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Suite de `fusion_help_type`, qui a ajouté `SERVICE`, `RIDE` et `MATERIAL` à
-- `HelpType`. PostgreSQL interdit d'employer une valeur d'enum dans la
-- transaction qui l'ajoute : la conversion vit donc ici.
--
-- ─── LA CONVERSION SE FAIT PAR NOM, ET NE PERD RIEN ───────────────────────
--
-- Chaque valeur de `HelpType2` a un HOMONYME dans `HelpType` :
--   PAPERWORK → PAPERWORK · SERVICE → SERVICE · RIDE → RIDE
--   MATERIAL  → MATERIAL  · OTHER   → OTHER
-- Le double transtypage par `text` suffit donc, sans table de correspondance et
-- sans arbitrage. Mesuré avant : 83 lignes sur `PAPERWORK` (65), `RIDE` (1) et
-- `MATERIAL` (17).
--
-- AUCUNE COLONNE N'EST SUPPRIMÉE. C'est la différence avec la migration que
-- Prisma proposait, qui faisait `DROP COLUMN` puis `ADD COLUMN` et aurait vidé
-- les 83 lignes en silence — elle l'annonçait elle-même : « No cast exists ».

ALTER TABLE "help_requests"
  ALTER COLUMN "type" TYPE "HelpType" USING "type"::text::"HelpType";

DROP TYPE IF EXISTS "HelpType2";

CREATE INDEX IF NOT EXISTS "help_requests_type_idx" ON "help_requests"("type");
