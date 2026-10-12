-- ═══════════════════════════════════════════════════════════════════════════
-- LES PAGES D'UN GUIDE — PARTIE 2 : LA REPRISE DES DONNÉES
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Trois gestes, dans cet ordre, pour CHAQUE guide qui existait avant les pages :
--
--   1. créer SA PAGE 1 — titre du guide, `position = 1`, slug dérivé du titre,
--      `current_version_id` = la version courante du guide ;
--   2. rattacher TOUTES ses `guide_versions` à cette page ;
--   3. déplacer ses COMMENTAIRES : `subject_type` GUIDE → GUIDE_PAGE,
--      `subject_id` → l'identifiant de la page 1.
--
-- ═══ MESURÉ AVANT ÉCRITURE (base de développement, 2026-10-10) ══════════════
--
--   · 127 guides, tous avec une `current_version_id` ;
--   · 127 `guide_versions` — une par guide ;
--   · 69 commentaires sur des guides : 68 sur des guides d'essai E2E
--     (24 + 22 + 21 + 1) et 1 sur un vrai guide
--     (`ouvrir-un-compte-bancaire-en-arrivant-en-france`). L'enjeu est faible,
--     la reprise doit être EXACTE quand même : ce commentaire est le mot de
--     quelqu'un.
--
-- ═══ ELLE EST REJOUABLE, ET C'EST LA PROPRIÉTÉ QUI COMPTE ══════════════════
--
-- Une reprise qui doublerait les pages au second passage transformerait un
-- incident de déploiement en corruption. Chacun des trois gestes est donc gardé :
--
--   · l'insertion ne vise que les guides SANS page (`NOT EXISTS`), et porte en
--     plus `ON CONFLICT (guide_id, position) DO NOTHING` — la garde et le filet ;
--   · le rattachement ne touche que les versions dont `page_id IS NULL`, et ne
--     les donne qu'à la page `position = 1` ;
--   · le déplacement ne touche que les lignes encore en `subject_type = 'GUIDE'`.
--
-- Deuxième passage attendu : 0 ligne insérée, 0 mise à jour.
--
-- ═══ LE SLUG EST CELUI QUE `slugifyGuideTitle` AURAIT PRODUIT ══════════════
--
-- L'expression ci-dessous reproduit `slugifyGuideTitle` (@app/shared) :
-- translittération, minuscules, tout ce qui n'est pas [a-z0-9] devient un tiret,
-- tirets de bord retirés, tronqué à 80, tiret final retiré, et « guide » en
-- dernier recours. `unaccent()` tient le rôle du `normalize('NFD')` du TypeScript
-- — l'extension est créée par la migration initiale, elle est donc acquise.
--
-- VÉRIFIÉ, pas supposé : les 127 titres de la base ont été passés dans les deux
-- implémentations et comparés un à un. **127 titres, 0 écart.** C'est la seule
-- preuve qui vaille, parce qu'un slug est figé à l'écriture et ne se recalcule
-- jamais (§2.1) : un écart ici serait définitif.
--
-- Aucun conflit d'unicité possible sur `(guide_id, slug)` : la page 1 est la
-- SEULE page de son guide au moment de cette migration.
--
-- ⚠ AUCUN DROP, AUCUN TRUNCATE, AUCUN ALTER COLUMN. Les lignes de `comments`
-- sont DÉPLACÉES, pas recréées : leur `id`, leur `created_at`, leur auteur et
-- leur `parent_comment_id` sont conservés tels quels, donc les réponses restent
-- accrochées à leur racine.

-- ── 1. Une page 1 par guide qui n'en a pas ────────────────────────────────────
INSERT INTO "guide_pages" (
  "id", "created_at", "updated_at", "deleted_at",
  "guide_id", "position", "title", "slug", "current_version_id"
)
SELECT
  gen_random_uuid(),
  g."created_at",
  now(),
  NULL,
  g."id",
  1,
  g."title",
  CASE
    WHEN length(regexp_replace(left(base, 80), '-+$', '', 'g')) >= 2
      THEN regexp_replace(left(base, 80), '-+$', '', 'g')
    ELSE 'guide'
  END,
  g."current_version_id"
FROM (
  SELECT
    "guides".*,
    regexp_replace(
      regexp_replace(
        regexp_replace(lower(unaccent("guides"."title")), '[^a-z0-9]+', '-', 'g'),
        '^-+|-+$', '', 'g'),
      '-{2,}', '-', 'g') AS base
  FROM "guides"
) g
WHERE NOT EXISTS (
  SELECT 1 FROM "guide_pages" p WHERE p."guide_id" = g."id"
)
ON CONFLICT ("guide_id", "position") DO NOTHING;

-- ── 2. Toutes les versions existantes rejoignent la page 1 de leur guide ─────
UPDATE "guide_versions" v
SET "page_id" = p."id"
FROM "guide_pages" p
WHERE p."guide_id" = v."guide_id"
  AND p."position" = 1
  AND v."page_id" IS NULL;

-- ── 3. Les commentaires passent du guide à sa page 1 ────────────────────────
UPDATE "comments" c
SET "subject_type" = 'GUIDE_PAGE',
    "subject_id"   = p."id"
FROM "guide_pages" p
WHERE c."subject_type" = 'GUIDE'
  AND p."guide_id" = c."subject_id"
  AND p."position" = 1;
