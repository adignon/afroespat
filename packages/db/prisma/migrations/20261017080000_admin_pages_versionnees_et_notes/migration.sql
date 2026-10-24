-- ════════════════════════════════════════════════════════════════════════════
-- ADMINISTRATION : VERSIONS DES PAGES STATIQUES ET NOTES INTERNES SUR UN MEMBRE
-- ════════════════════════════════════════════════════════════════════════════
--
-- 15 §4.1 : les pages statiques sont « versionnées » — `static_pages` ne porte que
-- la version EN VIGUEUR, `static_page_versions` garde l'historique et le brouillon.
-- 15 §3.2 / §6 : `member_notes`, notes internes visibles de l'équipe seulement.
--
-- STRICTEMENT ADDITIVE ET REJOUABLE : deux tables gardées par IF NOT EXISTS, leurs
-- index idem, clés étrangères posées dans des blocs qui vérifient leur absence.
-- Aucun DROP, aucun ALTER COLUMN, aucune donnée existante modifiée.
--
-- Les pages déjà publiées (`cgu`, `confidentialite`, en version « 0 ») reçoivent
-- leur ligne d'historique, pour que le prochain brouillon parte d'un numéro connu.

CREATE TABLE IF NOT EXISTS "static_page_versions" (
  "id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  "page_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "published_at" TIMESTAMPTZ,
  "changelog" TEXT,
  "created_by_staff_id" UUID,
  CONSTRAINT "static_page_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "static_page_versions_page_id_version_key" ON "static_page_versions"("page_id", "version");
CREATE INDEX IF NOT EXISTS "static_page_versions_page_id_idx" ON "static_page_versions"("page_id");

CREATE TABLE IF NOT EXISTS "member_notes" (
  "id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  "user_id" UUID NOT NULL,
  "staff_id" UUID NOT NULL,
  "body" TEXT NOT NULL,
  CONSTRAINT "member_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "member_notes_user_id_idx" ON "member_notes"("user_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'static_page_versions_page_id_fkey') THEN
    ALTER TABLE "static_page_versions" ADD CONSTRAINT "static_page_versions_page_id_fkey"
      FOREIGN KEY ("page_id") REFERENCES "static_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'static_page_versions_created_by_staff_id_fkey') THEN
    ALTER TABLE "static_page_versions" ADD CONSTRAINT "static_page_versions_created_by_staff_id_fkey"
      FOREIGN KEY ("created_by_staff_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'member_notes_user_id_fkey') THEN
    ALTER TABLE "member_notes" ADD CONSTRAINT "member_notes_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'member_notes_staff_id_fkey') THEN
    ALTER TABLE "member_notes" ADD CONSTRAINT "member_notes_staff_id_fkey"
      FOREIGN KEY ("staff_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Historique des pages déjà publiées : une ligne par page, au numéro de sa version
-- en vigueur lorsque celle-ci est un entier (le gabarit initial est « 0 »).
INSERT INTO "static_page_versions" ("id", "updated_at", "page_id", "version", "title", "body", "published_at")
SELECT gen_random_uuid(), CURRENT_TIMESTAMP, p."id", p."version"::INTEGER, p."title", p."body", p."published_at"
FROM "static_pages" p
WHERE p."version" ~ '^[0-9]+$'
  AND p."published_at" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "static_page_versions" v WHERE v."page_id" = p."id");
