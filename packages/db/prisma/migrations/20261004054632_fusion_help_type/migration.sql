-- ═══════════════════════════════════════════════════════════════════════════
-- FUSION DES DEUX ENUMS D'ENTRAIDE — PREMIÈRE MOITIÉ : LES VALEURS
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `HelpType` (profil) et `HelpType2` (demande) coexistaient avec TROIS MEMBRES
-- SUR CINQ DIFFÉRENTS. Sur l'écran de profil, « Trajet », « Traduction » et
-- « Matériel » n'avaient donc aucun code propre et retombaient tous les trois sur
-- `OTHER` : un membre disponible pour un trajet était indistinguable d'un autre
-- disponible pour du matériel, et aucun rapprochement avec une demande `RIDE`
-- n'était possible. Le porteur a tranché : un seul enum.
--
-- ─── POURQUOI CETTE MIGRATION EST COUPÉE EN DEUX ──────────────────────────
--
-- PostgreSQL interdit d'EMPLOYER une valeur d'enum ajoutée dans la même
-- transaction que son ajout. Or la conversion de `help_requests.type` convertit
-- des lignes qui valent `RIDE` et `MATERIAL` — deux des valeurs ajoutées ici.
-- Les deux moitiés sont donc deux migrations, et la seconde porte la conversion.
--
-- ─── CE QUE PRISMA PROPOSAIT, ET POURQUOI JE NE L'AI PAS PRIS ─────────────
--
-- Sa migration générée faisait `ALTER TABLE help_requests DROP COLUMN "type"`
-- puis `ADD COLUMN` — elle annonçait elle-même « No cast exists, the column would
-- be dropped and recreated ». Mesuré AVANT : 83 lignes, réparties sur `PAPERWORK`
-- (65), `RIDE` (1) et `MATERIAL` (17). Les trois auraient été perdues en silence.
-- La conversion par nom (seconde migration) ne perd rien, puisque chaque valeur de
-- `HelpType2` a son homonyme dans `HelpType`.

ALTER TYPE "HelpType" ADD VALUE IF NOT EXISTS 'SERVICE';
ALTER TYPE "HelpType" ADD VALUE IF NOT EXISTS 'RIDE';
ALTER TYPE "HelpType" ADD VALUE IF NOT EXISTS 'MATERIAL';
