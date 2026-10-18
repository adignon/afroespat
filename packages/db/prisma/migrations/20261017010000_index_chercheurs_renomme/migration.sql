-- ════════════════════════════════════════════════════════════════════════════
-- DÉRIVE D'INDEX : LE NOM QUE PRISMA ATTEND POUR LES CHERCHEURS DISTINCTS
-- ════════════════════════════════════════════════════════════════════════════
--
-- La migration 20261011180000 a créé l'index unique
-- `search_zero_result_seekers_query_normalized_city_id_occurr_key` ; le schéma
-- (`@@unique([queryNormalized, cityId, occurredOn, seekerHash])`) en attend un
-- autre nom, que Prisma tronque à `…_occurre_key`. `prisma migrate diff` le
-- proposait à chaque génération, et les migrations suivantes ont dû écrire « écart
-- antérieur, non repris ici ».
--
-- Strictement additive et rejouable : `ALTER INDEX IF EXISTS … RENAME` ne fait
-- rien si l'index porte déjà le bon nom (ou n'existe pas). Aucune donnée touchée,
-- aucune reconstruction d'index.
ALTER INDEX IF EXISTS "search_zero_result_seekers_query_normalized_city_id_occurr_key"
  RENAME TO "search_zero_result_seekers_query_normalized_city_id_occurre_key";
