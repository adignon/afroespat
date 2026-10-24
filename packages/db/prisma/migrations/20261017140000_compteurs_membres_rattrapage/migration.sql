-- Rattrapage des compteurs de membres (lot W2A, phase 2.4).
--
-- `communities.member_count` et `cities.member_count` sont des colonnes de
-- lecture : l'accueil (« Évry · 4 membres »), l'écran d'arrivée et la carte des
-- villes les servent telles quelles. Les écritures de l'application les tiennent
-- à jour (adhésion, départ, bannissement, changement de ville), mais les lignes
-- créées AVANT ces écritures portaient un compteur faux (1 pour 5 inscrits,
-- 0 pour une ville peuplée). Cette migration les recalcule UNE fois, sur la
-- définition que le recalcul nocturne emploie déjà :
--   · réseau : adhésions au statut ACTIVE ;
--   · ville  : membres ACTIVE non supprimés rattachés à la ville.
--
-- Additive et idempotente : un UPDATE conditionnel (`IS DISTINCT FROM`) qui
-- n'écrit que les lignes à corriger ; relancé, il n'écrit plus rien. Ni DROP,
-- ni ALTER, ni TRUNCATE.

UPDATE communities c
SET member_count = sub.total
FROM (
  SELECT co.id, COUNT(m.id)::int AS total
  FROM communities co
  LEFT JOIN community_members m
    ON m.community_id = co.id
   AND m.status::text = 'ACTIVE'
  GROUP BY co.id
) AS sub
WHERE c.id = sub.id
  AND c.member_count IS DISTINCT FROM sub.total;

UPDATE cities c
SET member_count = sub.total
FROM (
  SELECT ci.id, COUNT(u.id)::int AS total
  FROM cities ci
  LEFT JOIN users u
    ON u.city_id = ci.id
   AND u.deleted_at IS NULL
   AND u.status::text = 'ACTIVE'
  GROUP BY ci.id
) AS sub
WHERE c.id = sub.id
  AND c.member_count IS DISTINCT FROM sub.total;
