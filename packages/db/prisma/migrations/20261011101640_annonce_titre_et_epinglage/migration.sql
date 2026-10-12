-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ L'ANNONCE DE RÉSEAU GAGNE SON TITRE ET SON ÉPINGLAGE                    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Le porteur : « L'annonce : tous les champs doivent être branchés. »
--
-- MESURÉ, et c'était un écart de CONTRAT et non un oubli de branchement : la
-- planche « ADMIN · ANNONCE » dessine QUATRE contrôles — un titre, un corps,
-- « Épingler en haut du fil », « Notifier les 890 membres » — sur les DEUX
-- largeurs (1 036 px et 390 px). La table n'en portait que deux, `body` et
-- `notified_at`, et `createAnnouncementSchema` n'acceptait que `{ body }`. Deux
-- des quatre contrôles n'avaient donc nulle part où s'écrire.
--
-- ── CE QUE CETTE MIGRATION NE FAIT PAS ────────────────────────────────────
--
-- Aucun `DROP`, aucun `TRUNCATE`, aucun `ALTER COLUMN`, aucune ligne réécrite.
-- Deux colonnes AJOUTÉES, nullables, sans défaut : les annonces déjà publiées
-- gardent `title IS NULL` et `pinned_at IS NULL`, c'est-à-dire exactement le
-- comportement qu'elles avaient — sans titre, non épinglées. Une annonce sans
-- titre reste une annonce valide, ce que la planche permet elle aussi puisqu'elle
-- ne marque pas ce champ comme requis.
--
-- ── POURQUOI UN HORODATAGE PLUTÔT QU'UN BOOLÉEN ───────────────────────────
--
-- `notified_at` est déjà la convention de cette table : un instant nul veut dire
-- « le fait n'a pas eu lieu ». `pinned_at` la suit, et dit en plus DEPUIS QUAND,
-- ce qu'un `is_pinned` ne dira jamais.
--
-- ── POURQUOI PAS D'INDEX UNIQUE PARTIEL ───────────────────────────────────
--
-- L'épinglage est EXCLUSIF — une annonce épinglée par réseau — mais c'est le
-- service qui le tient, en déépinglant les autres dans la même transaction. Un
-- `CREATE UNIQUE INDEX … WHERE pinned_at IS NOT NULL` ferait ÉCHOUER la création
-- d'une seconde annonce épinglée au lieu de remplacer la première, et « Épingler
-- en haut du fil » promet le remplacement, pas le refus. L'index ci-dessous est
-- donc simplement celui qui retrouve l'épinglée d'un réseau sans balayer toutes
-- ses annonces.

-- AlterTable
ALTER TABLE "community_announcements" ADD COLUMN     "pinned_at" TIMESTAMPTZ,
ADD COLUMN     "title" TEXT;

-- CreateIndex
CREATE INDEX "community_announcements_community_id_pinned_at_idx" ON "community_announcements"("community_id", "pinned_at");
