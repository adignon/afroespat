-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ DEUX ARBITRAGES DU PORTEUR, DEUX FAITS QUI MANQUAIENT EN BASE            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Additive de bout en bout : aucun `DROP`, aucun `TRUNCATE`, aucun `ALTER COLUMN`,
-- aucune ligne existante touchée. Les deux défauts valent exactement le
-- comportement d'avant.
--
-- ── 1 · `guides.revision` — DE QUELLE VERSION UNE ÉCRITURE PART ────────────
--
-- Arbitrage : « le serveur refuse une écriture qui ne part pas de la version
-- courante, avec un message clair — ce guide a été modifié ailleurs, rechargez. »
--
-- MESURÉ AVANT, deux onglets sur le même BROUILLON, service appelé en direct :
-- une seule version en base, portant le texte du second onglet ; le texte du
-- premier introuvable dans toutes les versions. Et aucun état observable ne
-- distinguait les deux écritures — `updated_at` identique à la milliseconde sur
-- les trois relevés (avant, après A, après B), `current_version_id` inchangé,
-- `guide_versions.version` resté à 1 puisqu'un brouillon est modifié SUR PLACE.
--
-- D'où une colonne, et non la réutilisation d'un champ existant : il n'y en avait
-- aucun à réutiliser. Elle est incrémentée dans la MÊME instruction que l'écriture
-- du corps, sous `WHERE id = … AND revision = base` — zéro ligne touchée veut dire
-- qu'un autre éditeur est passé, et l'écriture est refusée.
--
-- `DEFAULT 0` : les guides existants partent de zéro, et un éditeur qui vient de
-- lire le guide lit ce même zéro. Rien à rattraper.
ALTER TABLE "guides"
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;

-- ── 2 · `search_zero_result_seekers` — DES PERSONNES, PAS DES RECHERCHES ───
--
-- Arbitrage : le panneau des « guides manquants » n'affiche qu'une requête
-- cherchée par PLUSIEURS PERSONNES DISTINCTES.
--
-- MESURÉ AVANT : `search_zero_results.count` compte les RECHERCHES. Trois appels
-- du MÊME membre donnent une seule ligne à `count: 3` — un seuil posé sur `count`
-- aurait donc été franchi par une personne seule, et le but de l'arbitrage manqué.
-- Le fait « combien de personnes » n'existait nulle part, et aucune colonne de
-- `search_zero_results` ne pouvait le porter : il y faut une ligne par personne.
--
-- AUCUN IDENTIFIANT DE MEMBRE N'ENTRE ICI, et c'est la règle dure du 11 §2.4.
-- `seeker_hash` est un HMAC-SHA256 de « requête normalisée | identifiant » sous une
-- sous-clé dérivée du secret applicatif. La requête entre dans le condensat : le
-- même membre porte donc un pseudonyme DIFFÉRENT sur chaque requête, et ces lignes
-- ne se recollent pas en profil. Le secret n'est pas en base.
CREATE TABLE "search_zero_result_seekers" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "query_normalized" TEXT NOT NULL,
    "city_id" UUID,
    "occurred_on" DATE NOT NULL,
    "seeker_hash" TEXT NOT NULL,

    CONSTRAINT "search_zero_result_seekers_pkey" PRIMARY KEY ("id")
);

-- L'unicité porte sur `city_id`, qui est NULLABLE, et PostgreSQL tient deux NULL
-- pour distincts : elle ne suffit donc PAS à dédupliquer une recherche sans ville.
-- C'est le service qui dédoublonne, sous le verrou consultatif qu'il pose déjà sur
-- (requête, ville, jour). La contrainte reste utile pour tous les cas AVEC ville,
-- et comme garde-fou si un second écrivain apparaissait un jour.
CREATE UNIQUE INDEX "search_zero_result_seekers_query_normalized_city_id_occurr_key"
  ON "search_zero_result_seekers"("query_normalized", "city_id", "occurred_on", "seeker_hash");

-- Le comptage lit toujours « cette requête, depuis cette date ».
CREATE INDEX "search_zero_result_seekers_query_normalized_occurred_on_idx"
  ON "search_zero_result_seekers"("query_normalized", "occurred_on");

-- PAS DE CLÉ ÉTRANGÈRE SUR `city_id`, délibérément : la déclarer imposerait une
-- liste de retour sur `City`, dans un fichier de schéma que ce lot n'a pas à
-- toucher. Une ville supprimée ne laisse ici qu'un pseudonyme orphelin — qui ne
-- désigne rien et ne fausse aucun comptage, le filtre par ville ne le retrouvant
-- plus.
