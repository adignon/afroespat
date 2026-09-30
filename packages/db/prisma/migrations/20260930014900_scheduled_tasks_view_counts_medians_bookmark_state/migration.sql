-- CreateEnum
CREATE TYPE "BookmarkState" AS ENUM ('AVAILABLE', 'EXPIRED', 'RESOLVED', 'PAST', 'UNAVAILABLE', 'UPDATED', 'REMOVED');

-- AlterTable
ALTER TABLE "bookmarks" ADD COLUMN     "state" "BookmarkState" NOT NULL DEFAULT 'AVAILABLE',
ADD COLUMN     "state_checked_at" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "guides" ADD COLUMN     "view_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "saved_alerts" ADD COLUMN     "match_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "housing_price_medians" (
    "city_id" UUID NOT NULL,
    "kind" "HousingKind" NOT NULL,
    "median_cents" INTEGER NOT NULL,
    "sample_size" INTEGER NOT NULL,
    "computed_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "housing_price_medians_pkey" PRIMARY KEY ("city_id","kind")
);

-- CreateIndex
CREATE INDEX "bookmarks_subject_type_subject_id_idx" ON "bookmarks"("subject_type", "subject_id");

-- AddForeignKey
ALTER TABLE "housing_price_medians" ADD CONSTRAINT "housing_price_medians_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
