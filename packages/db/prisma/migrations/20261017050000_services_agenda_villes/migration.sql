-- ════════════════════════════════════════════════════════════════════════════
-- LOT E — SERVICES, AGENDA, VILLES : LES COLONNES QUE LES SPECS 09 ET 10 AJOUTENT
-- ════════════════════════════════════════════════════════════════════════════
--
-- Toutes sont nommées « Ajoutée » dans 09 §4 ou 10 §5, et toutes manquaient :
--
--   · `housing_listings.hidden_from_user_ids` (10 §2.3, §5) — l'auteur masque son
--     annonce à un membre, sans blocage global. Lu par la liste ET le détail.
--   · `events.cancelled_at`, `events.cancel_reason` (09 §3.4, §4) — le motif ne
--     vivait que dans l'outbox, et la tâche `event.hide_cancelled` mesurait les
--     sept jours sur `updated_at`, que n'importe quelle écriture déplace.
--   · `city_tips.venue_name`, `city_tips.address_text` (09 §2.3, §4) — un
--     « produit du pays » porte un nom et une adresse texte, jamais géocodée.
--   · `city_tip_votes` (09 §2.3, §4) — le vote « utile », un par membre.
--   · `user_profiles.show_as_newcomer` (09 §2.4, §4) — défaut VRAI, comme la spec.
--   · `ReportSubjectType.CITY_TIP` — 09 §2.3 : « Signalable ».
--
-- STRICTEMENT ADDITIVE et rejouable : chaque colonne, table, index et contrainte
-- est gardé (IF NOT EXISTS ou bloc DO qui vérifie l'absence). Aucun DROP, aucun
-- ALTER COLUMN, aucune donnée réécrite — sauf UNE reprise, bornée et sans perte :
-- les événements DÉJÀ annulés reçoivent `cancelled_at = updated_at`, qui était
-- exactement la borne lue jusqu'ici. Sans elle, un événement annulé hier serait
-- resté visible pour toujours (cancelled_at NULL).

ALTER TABLE "housing_listings" ADD COLUMN IF NOT EXISTS "hidden_from_user_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];

ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMPTZ;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "cancel_reason" TEXT;
UPDATE "events" SET "cancelled_at" = "updated_at" WHERE "status" = 'CANCELLED' AND "cancelled_at" IS NULL;

ALTER TABLE "city_tips" ADD COLUMN IF NOT EXISTS "venue_name" TEXT;
ALTER TABLE "city_tips" ADD COLUMN IF NOT EXISTS "address_text" TEXT;

ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "show_as_newcomer" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "city_tip_votes" (
  "id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "city_tip_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  CONSTRAINT "city_tip_votes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "city_tip_votes_city_tip_id_user_id_key" ON "city_tip_votes"("city_tip_id", "user_id");
CREATE INDEX IF NOT EXISTS "city_tip_votes_user_id_idx" ON "city_tip_votes"("user_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'city_tip_votes_city_tip_id_fkey') THEN
    ALTER TABLE "city_tip_votes" ADD CONSTRAINT "city_tip_votes_city_tip_id_fkey"
      FOREIGN KEY ("city_tip_id") REFERENCES "city_tips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'city_tip_votes_user_id_fkey') THEN
    ALTER TABLE "city_tip_votes" ADD CONSTRAINT "city_tip_votes_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TYPE "ReportSubjectType" ADD VALUE IF NOT EXISTS 'CITY_TIP';
