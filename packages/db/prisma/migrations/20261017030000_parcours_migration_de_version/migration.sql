-- ════════════════════════════════════════════════════════════════════════════
-- PARCOURS : MIGRER VERS LA VERSION PUBLIÉE COURANTE DU MODÈLE (03 §2.2, §4)
-- ════════════════════════════════════════════════════════════════════════════
--
-- 03 §4 annonce `journeys.migrated_from_version_id` comme « ajoutée, facultatif » :
-- la colonne n'avait jamais été écrite. `POST /journeys/:id/migrate` la remplit, et
-- le journal du parcours reçoit une activité `TEMPLATE_MIGRATED` pour que le membre
-- retrouve ce qui s'est passé (étapes conservées, nouvelles, devenues personnelles).
--
-- STRICTEMENT ADDITIVE ET REJOUABLE : une valeur d'énumération et une colonne,
-- chacune gardée par IF NOT EXISTS ; la clé étrangère est posée dans un bloc qui
-- vérifie son absence. Aucun DROP, aucun ALTER COLUMN, aucune donnée touchée. La
-- nouvelle valeur d'énumération n'est PAS employée dans cette migration (Postgres
-- interdit de l'utiliser dans la transaction qui la crée).

ALTER TYPE "JourneyActivityType" ADD VALUE IF NOT EXISTS 'TEMPLATE_MIGRATED';

ALTER TABLE "journeys" ADD COLUMN IF NOT EXISTS "migrated_from_version_id" UUID;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'journeys_migrated_from_version_id_fkey') THEN
    ALTER TABLE "journeys" ADD CONSTRAINT "journeys_migrated_from_version_id_fkey"
      FOREIGN KEY ("migrated_from_version_id") REFERENCES "journey_template_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
