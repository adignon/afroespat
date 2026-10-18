-- ════════════════════════════════════════════════════════════════════════════
-- ENTRAIDE ET PARRAINAGE : LES QUATRE COLONNES « AJOUTÉES » PAR LES SPECS
-- ════════════════════════════════════════════════════════════════════════════
--
-- 06-entraide.md §3 déclare « Ajoutée » `help_requests.reopened_at` et
-- `help_requests.archived_at` ; 08-parrainage-messagerie.md §6 déclare
-- « Ajoutée » `mentorships.extended_once` (booléen) et `mentorships.expires_at`
-- (expiration de la demande à 7 jours). Aucune des quatre n'existait : le
-- service de parrainage DÉDUISAIT les deux siennes (`ends_at - accepted_at` et
-- `created_at + 7 jours`), et l'entraide ne gardait aucune trace de ses
-- réouvertures ni de la date de ses archivages.
--
-- STRICTEMENT ADDITIVE et rejouable : quatre colonnes gardées par
-- IF NOT EXISTS, un index, et trois reprises de données qui ne touchent QUE des
-- lignes encore vides (rejouer la migration ne réécrit rien). Aucun DROP, aucun
-- ALTER COLUMN.
--
-- LES REPRISES REFONT EXACTEMENT LA DÉDUCTION QUE LE SERVICE FAISAIT, pour que
-- le passage de la déduction à la colonne ne change aucun état visible :
--   · « déjà prolongé » ⟺ ends_at > accepted_at + 90 jours + 1 minute — la
--     marge d'une minute est celle de l'ancien `isExtended()` ;
--   · une demande de parrainage expire à created_at + 7 jours.
-- Les demandes d'entraide archivées AVANT cette migration reçoivent `updated_at`
-- comme date d'archivage : c'est la dernière écriture de la ligne, donc la plus
-- proche approximation disponible — et la seule qui ne soit pas inventée.

ALTER TABLE "help_requests" ADD COLUMN IF NOT EXISTS "reopened_at" TIMESTAMPTZ;
ALTER TABLE "help_requests" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ;

ALTER TABLE "mentorships" ADD COLUMN IF NOT EXISTS "extended_once" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "mentorships" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ;

UPDATE "help_requests"
   SET "archived_at" = "updated_at"
 WHERE "status" = 'ARCHIVED' AND "archived_at" IS NULL;

UPDATE "mentorships"
   SET "extended_once" = true
 WHERE "extended_once" = false
   AND "accepted_at" IS NOT NULL
   AND "ends_at" IS NOT NULL
   AND "ends_at" > "accepted_at" + INTERVAL '90 days' + INTERVAL '1 minute';

UPDATE "mentorships"
   SET "expires_at" = "created_at" + INTERVAL '7 days'
 WHERE "expires_at" IS NULL;

-- La tâche `mentorship.expire_requests` et la règle « une seule demande en
-- attente » filtrent toutes deux sur (status, expires_at).
CREATE INDEX IF NOT EXISTS "mentorships_status_expires_at_idx" ON "mentorships"("status", "expires_at");
