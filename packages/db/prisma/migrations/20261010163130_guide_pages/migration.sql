-- ═══════════════════════════════════════════════════════════════════════════
-- LES PAGES D'UN GUIDE — PARTIE 1 : LA STRUCTURE, RIEN QUE LA STRUCTURE
-- ═══════════════════════════════════════════════════════════════════════════
--
-- STRICTEMENT ADDITIVE : aucun DROP, aucun TRUNCATE, aucun ALTER COLUMN. Relue
-- ligne à ligne avant application. `guide_versions.page_id` naît NULLABLE —
-- la rendre NOT NULL serait un ALTER COLUMN, et la reprise (partie 2) la
-- renseigne partout.
--
-- POURQUOI DEUX MIGRATIONS, ET PAS UNE :
--
--   PostgreSQL refuse d'EMPLOYER une valeur d'énumération ajoutée dans la même
--   transaction que son `ALTER TYPE … ADD VALUE` (« unsafe use of new value of
--   enum type »). La reprise de données écrit `subject_type = 'GUIDE_PAGE'` : si
--   elle était ici, elle échouerait au premier `UPDATE`. La migration suivante,
--   `…_guide_pages_reprise`, porte donc toute la reprise — et elle est écrite
--   pour être REJOUABLE.
--
-- `(guide_id, position)` est un index unique NON différable : voir l'en-tête du
-- modèle `GuidePage` pour ce que cela impose au déplacement d'une page.

-- AlterEnum
ALTER TYPE "CommentSubjectType" ADD VALUE 'GUIDE_PAGE';

-- AlterTable
ALTER TABLE "guide_versions" ADD COLUMN     "page_id" UUID;

-- CreateTable
CREATE TABLE "guide_pages" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "guide_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "current_version_id" UUID,

    CONSTRAINT "guide_pages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guide_pages_guide_id_idx" ON "guide_pages"("guide_id");

-- CreateIndex
CREATE UNIQUE INDEX "guide_pages_guide_id_slug_key" ON "guide_pages"("guide_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "guide_pages_guide_id_position_key" ON "guide_pages"("guide_id", "position");

-- CreateIndex
CREATE INDEX "guide_versions_page_id_idx" ON "guide_versions"("page_id");

-- AddForeignKey
ALTER TABLE "guide_pages" ADD CONSTRAINT "guide_pages_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_pages" ADD CONSTRAINT "guide_pages_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "guide_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_versions" ADD CONSTRAINT "guide_versions_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "guide_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
