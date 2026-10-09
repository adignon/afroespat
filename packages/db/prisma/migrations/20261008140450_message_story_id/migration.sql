-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "story_id" UUID;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
