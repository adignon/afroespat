-- La longueur d'un numéro national, par pays.
--
-- Le porteur : « il faut la validation du numéro selon le pays. Backend et
-- frontend aussi pour valider le format. » Mesuré avant : un numéro béninois de
-- 17 chiffres était accepté par `POST /auth/otp/request`.
--
-- La règle vit dans le RÉFÉRENTIEL et non dans le code : un plan de numérotation
-- change (Bénin 2023, Côte d'Ivoire 2021), et l'équipe doit pouvoir le corriger
-- en back-office. NULL veut dire « on ne sait pas » — le numéro n'est alors
-- contrôlé que par sa forme internationale.
--
-- STRICTEMENT ADDITIVE : une colonne nullable, sans défaut à écrire. Les valeurs
-- ci-dessous sont posées par `UPDATE` ciblés sur l'ISO2 ; un pays absent de la
-- liste reste à NULL, donc inchangé.
ALTER TABLE "countries" ADD COLUMN "phone_national_length" INTEGER;

-- Les dix-sept pays du référentiel. Chaque longueur est celle du numéro SANS
-- l'indicatif et sans le zéro de service. À FAIRE VALIDER PAR LE PORTEUR : ce
-- sont des faits de plan de numérotation, pas des choix de produit, et une
-- valeur fausse bloquerait l'inscription d'un pays entier.
UPDATE "countries" SET "phone_national_length" = 10 WHERE "iso2" = 'BJ'; -- depuis 2023
UPDATE "countries" SET "phone_national_length" = 8  WHERE "iso2" = 'TG';
UPDATE "countries" SET "phone_national_length" = 9  WHERE "iso2" = 'FR';
UPDATE "countries" SET "phone_national_length" = 10 WHERE "iso2" = 'CI'; -- depuis 2021
UPDATE "countries" SET "phone_national_length" = 9  WHERE "iso2" = 'SN';
UPDATE "countries" SET "phone_national_length" = 9  WHERE "iso2" = 'CM';
UPDATE "countries" SET "phone_national_length" = 8  WHERE "iso2" = 'ML';
UPDATE "countries" SET "phone_national_length" = 8  WHERE "iso2" = 'BF';
UPDATE "countries" SET "phone_national_length" = 8  WHERE "iso2" = 'NE';
UPDATE "countries" SET "phone_national_length" = 8  WHERE "iso2" = 'GA';
UPDATE "countries" SET "phone_national_length" = 9  WHERE "iso2" = 'CG';
UPDATE "countries" SET "phone_national_length" = 9  WHERE "iso2" = 'CD';
UPDATE "countries" SET "phone_national_length" = 9  WHERE "iso2" = 'GN';
UPDATE "countries" SET "phone_national_length" = 9  WHERE "iso2" = 'MA';
UPDATE "countries" SET "phone_national_length" = 9  WHERE "iso2" = 'DZ';
UPDATE "countries" SET "phone_national_length" = 8  WHERE "iso2" = 'TN';
UPDATE "countries" SET "phone_national_length" = 9  WHERE "iso2" = 'MG';
