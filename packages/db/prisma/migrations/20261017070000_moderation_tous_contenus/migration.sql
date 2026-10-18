-- Lot G — le pipeline de modération couvre tous les contenus publiés.
-- Additif et idempotent : deux valeurs d'énumération, une table.

ALTER TYPE "ReportSubjectType" ADD VALUE IF NOT EXISTS 'STORY';
ALTER TYPE "ReportSubjectType" ADD VALUE IF NOT EXISTS 'CITY_TIP';

CREATE TABLE IF NOT EXISTS "moderation_hides" (
  "subject_type" "ReportSubjectType" NOT NULL,
  "subject_id"   UUID NOT NULL,
  "hidden_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "prior_state"  TEXT NOT NULL,
  "case_id"      UUID,
  CONSTRAINT "moderation_hides_pkey" PRIMARY KEY ("subject_type", "subject_id")
);

-- L'alerte interne adressée à un compte de l'équipe (moderation.sla_alert).
CREATE TABLE IF NOT EXISTS "staff_alerts" (
  "id"         UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "staff_id"   UUID NOT NULL,
  "kind"       TEXT NOT NULL,
  "title"      TEXT NOT NULL,
  "body"       TEXT,
  "ref_type"   TEXT,
  "ref_id"     UUID NOT NULL,
  "read_at"    TIMESTAMPTZ,
  CONSTRAINT "staff_alerts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "staff_alerts_staff_id_kind_ref_id_key"
  ON "staff_alerts" ("staff_id", "kind", "ref_id");
CREATE INDEX IF NOT EXISTS "staff_alerts_staff_id_read_at_idx"
  ON "staff_alerts" ("staff_id", "read_at");

DO $$ BEGIN
  ALTER TABLE "staff_alerts"
    ADD CONSTRAINT "staff_alerts_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "staff_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
