-- AlterEnum
ALTER TYPE "MediaKind" ADD VALUE 'GUIDE';

-- CreateTable
CREATE TABLE "guide_media" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guide_id" UUID NOT NULL,
    "media_asset_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "guide_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guide_media_guide_id_idx" ON "guide_media"("guide_id");

-- AddForeignKey
ALTER TABLE "guide_media" ADD CONSTRAINT "guide_media_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_media" ADD CONSTRAINT "guide_media_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
