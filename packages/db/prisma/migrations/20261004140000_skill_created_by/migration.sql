-- Une compétence écrite à la main par un membre.
--
-- Le porteur : « free typing qui crée de nouvelles compétences que les
-- administrateurs peuvent globaliser […] un createdBy si c'est uniquement pour
-- cet utilisateur ». NULL = globale, visible et choisissable par tous — c'est
-- déjà l'état des 60 compétences semées, qui n'appartiennent à personne.
--
-- STRICTEMENT ADDITIVE : une colonne qui n'existait pas, nullable, sans défaut à
-- écrire, plus son index. Aucune ligne n'est lue, réécrite ni supprimée ; les
-- compétences existantes restent à NULL, c'est-à-dire globales.
ALTER TABLE "skills" ADD COLUMN "created_by_user_id" UUID;
CREATE INDEX IF NOT EXISTS "skills_created_by_user_id_idx" ON "skills" ("created_by_user_id");
