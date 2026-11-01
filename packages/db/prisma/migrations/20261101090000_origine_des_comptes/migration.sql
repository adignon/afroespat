-- Origine d'un compte : inscrit par la personne (MEMBER) ou créé par un chargement de données de départ (SEED).
-- Lue par l'administration seulement (filtre, suppression en lot) ; jamais exposée aux membres.

-- CreateEnum
CREATE TYPE "UserOrigin" AS ENUM ('MEMBER', 'SEED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "origin" "UserOrigin" NOT NULL DEFAULT 'MEMBER';
