-- AlterTable
ALTER TABLE "communities" ADD COLUMN     "warning_sent_at" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "community_members" ADD COLUMN     "invited_by_user_id" UUID,
ADD COLUMN     "muted" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "community_members_community_id_status_muted_idx" ON "community_members"("community_id", "status", "muted");

-- CreateIndex
CREATE INDEX "community_members_invited_by_user_id_idx" ON "community_members"("invited_by_user_id");

-- AddForeignKey
ALTER TABLE "community_members" ADD CONSTRAINT "community_members_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
