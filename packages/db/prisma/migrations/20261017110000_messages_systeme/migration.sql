-- Messages système d'une conversation de parcours (lot F2) — additif et idempotent.
-- `system_kind` NULL = message écrit par un membre. `system_ref` = identifiant de
-- l'événement d'outbox : (conversation, ref) unique => une livraison rejouée n'écrit
-- qu'une ligne. Postgres autorise plusieurs NULL dans un index unique.
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "system_kind" TEXT;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "system_ref" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "messages_conversation_id_system_ref_key"
  ON "messages" ("conversation_id", "system_ref");
