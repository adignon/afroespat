-- ════════════════════════════════════════════════════════════════════════════
-- LES PARAMÈTRES D'UN RÉSEAU, SES RÈGLES, ET LA VALIDATION DES PUBLICATIONS
-- ════════════════════════════════════════════════════════════════════════════
--
-- Migration ADDITIVE uniquement : aucun DROP, aucun TRUNCATE, aucun ALTER COLUMN.
-- Les défauts reproduisent le comportement d'avant la migration — validation
-- éteinte, sondages et album ouverts aux membres, aucune règle — donc aucun
-- réseau existant ne change de comportement en l'appliquant.
--
-- ⚠ TOUT EST ÉCRIT « IF NOT EXISTS », et c'est la seconde moitié de ce fichier
-- qui l'exige. Le schéma Prisma déclarait déjà le fil « Contacter les
-- modérateurs » (`ConversationKind.COMMUNITY_MODERATION`,
-- `conversations.community_id`, `conversations.opened_by_user_id`) SANS
-- qu'aucune migration commitée ne le crée : mesuré sur une base neuve,
-- `prisma migrate diff` réclamait ces colonnes, et `POST
-- /communities/:id/moderators-conversation` y tombait en erreur. Une base de
-- développement qui les aurait déjà reçues par un `migrate dev` local non commité
-- passe donc ici sans erreur.

-- ── Le fil « Contacter les modérateurs » (rattrapage) ───────────────────────
ALTER TYPE "ConversationKind" ADD VALUE IF NOT EXISTS 'COMMUNITY_MODERATION';

ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "community_id" UUID;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "opened_by_user_id" UUID;

CREATE INDEX IF NOT EXISTS "conversations_community_id_idx" ON "conversations"("community_id");
CREATE UNIQUE INDEX IF NOT EXISTS "conversations_community_id_opened_by_user_id_key"
  ON "conversations"("community_id", "opened_by_user_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversations_community_id_fkey') THEN
    ALTER TABLE "conversations" ADD CONSTRAINT "conversations_community_id_fkey"
      FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversations_opened_by_user_id_fkey') THEN
    ALTER TABLE "conversations" ADD CONSTRAINT "conversations_opened_by_user_id_fkey"
      FOREIGN KEY ("opened_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ── Les trois interrupteurs de « Paramètres » et les règles du réseau ───────
ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "posts_require_approval" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "polls_open_to_members" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "album_open_to_members" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "rules" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- ── Une publication qui attend la validation d'un modérateur ────────────────
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "awaiting_approval" BOOLEAN NOT NULL DEFAULT false;

-- ── « Signaler le réseau » — un réseau devient un sujet de signalement ──────
-- Le bouton de l'onglet « À propos » envoyait `subjectType: COMMUNITY`, que
-- l'enum ne connaissait pas : le serveur répondait 400 et la fenêtre de
-- signalement ne pouvait aboutir.
ALTER TYPE "ReportSubjectType" ADD VALUE IF NOT EXISTS 'COMMUNITY';
