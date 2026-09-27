-- DropIndex
DROP INDEX "search_documents_tsv_idx";

-- AlterTable
ALTER TABLE "otp_challenges" ADD COLUMN     "phone_encrypted" BYTEA;
