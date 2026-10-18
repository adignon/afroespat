-- Adresse email du membre (12 §3) : chiffrée comme le téléphone, vérifiée par code.
-- Additive et idempotente : aucune colonne existante n'est touchée.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_encrypted" BYTEA;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified_at" TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS "email_verifications" (
  "id"              UUID        NOT NULL,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sent_at"         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "user_id"         UUID        NOT NULL,
  "email_encrypted" BYTEA       NOT NULL,
  "code_hash"       TEXT        NOT NULL,
  "attempts"        INTEGER     NOT NULL DEFAULT 0,
  "expires_at"      TIMESTAMPTZ NOT NULL,
  CONSTRAINT "email_verifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_verifications_user_id_key" ON "email_verifications" ("user_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_verifications_user_id_fkey'
  ) THEN
    ALTER TABLE "email_verifications"
      ADD CONSTRAINT "email_verifications_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
