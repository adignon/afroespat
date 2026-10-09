-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ LE SONDAGE ET LES GUIDES LIÉS D'UNE PUBLICATION DU FIL                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Le porteur : « la création de sondage, les guides […] ne marchent pas ». Ils
-- étaient dessinés depuis le premier jour — « Créer un sondage », « Lier un
-- guide », et la carte de publication a son bloc de sondage — et la base ne
-- savait pas les porter.
--
-- ── CE QUI EXISTAIT DÉJÀ, ET QU'ON NE REFAIT PAS ──────────────────────────
--
-- Le mécanisme de sondage est ENTIER depuis le module 07 : options, votes,
-- compte par option, vote modifiable, résultats masqués avant vote, clôture. Il
-- lui manquait une seule chose — pouvoir appartenir à autre chose qu'un réseau.
-- Un second modèle aurait dupliqué les quatre tables et les quatre règles.
--
-- ── CETTE MIGRATION N'EFFACE RIEN ─────────────────────────────────────────
--
-- Elle rend une colonne FACULTATIVE, en ajoute deux, crée une table et pose deux
-- contraintes. Aucun `DROP TABLE`, aucun `DROP COLUMN`, aucune donnée touchée :
-- les sondages de réseau existants gardent leur `community_id` et passent la
-- contrainte d'exclusivité sans être modifiés.

-- ── 1. UN SONDAGE PEUT N'APPARTENIR À AUCUN RÉSEAU ────────────────────────
ALTER TABLE "polls" ALTER COLUMN "community_id" DROP NOT NULL;

-- ── 2. … ET APPARTENIR À UNE PUBLICATION ──────────────────────────────────
--
-- `UNIQUE` tient la règle que la maquette énonce en toutes lettres sous sa carte
-- « Sondage » : « Un seul par publication. » C'est une borne de produit, et elle
-- est posée là où elle ne peut pas être contournée.
ALTER TABLE "polls" ADD COLUMN "post_id" UUID;

ALTER TABLE "polls"
  ADD CONSTRAINT "polls_post_id_fkey"
  FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "polls_post_id_key" ON "polls"("post_id");
CREATE INDEX "polls_post_id_idx" ON "polls"("post_id");

-- ── 3. EXACTEMENT L'UN DES DEUX, JAMAIS LES DEUX, JAMAIS AUCUN ────────────
--
-- Sans cette contrainte, deux états impossibles deviendraient représentables :
-- un sondage ORPHELIN — que personne ne peut voir ni voter, puisque la
-- visibilité se déduit de son porteur — et un sondage À DEUX MAÎTRES, dont les
-- deux porteurs donneraient deux réponses différentes à « qui peut voter ».
-- Prisma ne sait pas exprimer un OU exclusif ; PostgreSQL, si.
ALTER TABLE "polls"
  ADD CONSTRAINT "polls_rattachement"
  CHECK (("community_id" IS NULL) <> ("post_id" IS NULL));

-- ── 4. LES GUIDES LIÉS ────────────────────────────────────────────────────
--
-- « Jusqu'à 3 » est une borne de produit que le schéma ne peut pas exprimer —
-- aucun SGBD ne dit « au plus trois lignes par clé » sans déclencheur. Elle est
-- tenue à la frontière (`createPostSchema`) ET dans le service. La clé primaire
-- composite, elle, tient ce qu'un schéma SAIT tenir : on ne lie pas deux fois le
-- même guide à la même publication.
CREATE TABLE "post_guides" (
  "post_id"  UUID    NOT NULL,
  "guide_id" UUID    NOT NULL,
  "position" INTEGER NOT NULL,

  CONSTRAINT "post_guides_pkey" PRIMARY KEY ("post_id", "guide_id")
);

CREATE INDEX "post_guides_guide_id_idx" ON "post_guides"("guide_id");

ALTER TABLE "post_guides"
  ADD CONSTRAINT "post_guides_post_id_fkey"
  FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "post_guides"
  ADD CONSTRAINT "post_guides_guide_id_fkey"
  FOREIGN KEY ("guide_id") REFERENCES "guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;
