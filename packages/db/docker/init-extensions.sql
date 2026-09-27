-- Extensions requises par 00-fondations.md §2.
-- unaccent + pg_trgm : recherche full-text insensible aux accents et approximative.
-- citext : unicité insensible à la casse (handle, email d'équipe).
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;

-- NOTE : ce fichier n'est PAS monté dans docker-compose. En local, Prisma crée
-- les extensions par migration (déclarées dans prisma/schema/00-base.prisma).
-- Il sert de référence si l'utilisateur applicatif de production n'a pas le
-- droit CREATE EXTENSION : un administrateur les crée alors une fois à la main.
