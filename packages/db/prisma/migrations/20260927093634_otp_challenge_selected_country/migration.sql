/*
  Warnings:

  - Added the required column `country_id` to the `otp_challenges` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "otp_challenges" ADD COLUMN     "country_id" UUID NOT NULL;

-- AddForeignKey
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
