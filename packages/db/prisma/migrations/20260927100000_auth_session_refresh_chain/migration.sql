-- La chaîne de rafraîchissement (01-identite.md §2.1).
--
-- §2.1 exige la « révocation de la chaîne en cas de réutilisation ». Le schéma
-- ne portait qu'un hachage, écrasé à chaque rotation : l'ancien jeton ne
-- correspondait plus à aucune ligne, et son rejeu était indiscernable d'un
-- jeton inconnu. La détection ne se déclenchait donc JAMAIS.
--
-- Le jeton s'écrit désormais `chainId.génération.secret`.

ALTER TABLE "auth_sessions"
  ADD COLUMN "chain_id"         UUID,
  ADD COLUMN "token_generation" INTEGER NOT NULL DEFAULT 0;

-- Les sessions déjà ouvertes portent des jetons de l'ANCIEN format, sans
-- chaîne : elles ne peuvent pas être reprises. On leur donne une chaîne pour
-- satisfaire la contrainte, puis on les révoque — leurs porteurs se
-- reconnecteront. Les laisser vivre reviendrait à garder en circulation des
-- jetons que la nouvelle détection de rejeu ne sait pas juger.
UPDATE "auth_sessions" SET "chain_id" = gen_random_uuid() WHERE "chain_id" IS NULL;
UPDATE "auth_sessions" SET "revoked_at" = now() WHERE "revoked_at" IS NULL;

ALTER TABLE "auth_sessions" ALTER COLUMN "chain_id" SET NOT NULL;

CREATE UNIQUE INDEX "auth_sessions_chain_id_key" ON "auth_sessions"("chain_id");
