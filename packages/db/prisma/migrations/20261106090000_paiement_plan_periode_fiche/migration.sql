-- Ce que le paiement achète : plan, période, fiche pro (nul pour les paiements antérieurs).
-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "period" "PlanInterval",
ADD COLUMN     "plan_code" "PlanCode",
ADD COLUMN     "pro_profile_id" UUID;
