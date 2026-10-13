-- ════════════════════════════════════════════════════════════════════════════
-- RÉSEAUX : LE LOGO, LES DEUX MODES DE VALIDATION, LA COUVERTURE D'UN ALBUM
-- ════════════════════════════════════════════════════════════════════════════
--
-- Le porteur : « le logo et la photo de couverture doivent pouvoir être
-- changés » ; « la validation de la publication dépend des paramètres du
-- réseau. Deux options : valider toutes les publications, valider X
-- publications pour chaque membre. »
--
-- STRICTEMENT ADDITIVE, et rejouable : un type et trois colonnes, chacun gardé
-- par IF NOT EXISTS ; la clé étrangère est posée dans un bloc qui vérifie son
-- absence. Aucun DROP, aucun ALTER COLUMN, aucune donnée touchée.
--
-- LES DÉFAUTS NE CHANGENT RIEN AUX RÉSEAUX EXISTANTS : `FIRST_POSTS` et 1
-- reproduisent exactement ce que faisait `posts_require_approval` seul — la
-- première publication d'un nouveau membre attend un modérateur.
--
-- `prisma migrate diff` proposait aussi de renommer l'index
-- `search_zero_result_seekers_query_normalized_city_id_occurr_key` : c'est un
-- écart ANTÉRIEUR, sans rapport avec ce lot, et il n'est pas repris ici.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CommunityPostApprovalScope') THEN
    CREATE TYPE "CommunityPostApprovalScope" AS ENUM ('ALL', 'FIRST_POSTS');
  END IF;
END $$;

ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "logo_asset_id" UUID;
ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "posts_approval_scope" "CommunityPostApprovalScope" NOT NULL DEFAULT 'FIRST_POSTS';
ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "posts_approval_count" INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'communities_logo_asset_id_fkey') THEN
    ALTER TABLE "communities" ADD CONSTRAINT "communities_logo_asset_id_fkey"
      FOREIGN KEY ("logo_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ── LA PHOTO DE COUVERTURE D'UN ALBUM ─────────────────────────────────────────
--
-- « Couverture » dans la barre de sélection de l'album : l'équipe choisit la
-- photo qui représente l'album. Nulle = la plus récente, comme avant. Une photo
-- supprimée remet la colonne à nul (ON DELETE SET NULL).
ALTER TABLE "albums" ADD COLUMN IF NOT EXISTS "cover_photo_id" UUID;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'albums_cover_photo_id_fkey') THEN
    ALTER TABLE "albums" ADD CONSTRAINT "albums_cover_photo_id_fkey"
      FOREIGN KEY ("cover_photo_id") REFERENCES "album_photos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
