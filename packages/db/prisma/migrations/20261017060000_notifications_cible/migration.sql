-- ════════════════════════════════════════════════════════════════════════════
-- NOTIFICATIONS : LA CIBLE D'UNE LIGNE (12 §2.7)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Les lignes de la page « Notifications » devaient mener quelque part, et la
-- table n'avait aucune colonne pour le dire : `refType` + `refId` ne suffisent
-- pas (pour une notification de message, `refId` est le MESSAGE et non la
-- conversation ; pour une réponse d'entraide c'est la RÉPONSE, pas la demande).
-- Les gestionnaires d'événements calculaient déjà une adresse (`url`) pour le
-- push, puis la jetaient. On la garde.
--
-- STRICTEMENT ADDITIVE ET REJOUABLE : une colonne facultative, gardée par
-- IF NOT EXISTS. Les lignes existantes restent à NULL — l'écran retombe alors sur
-- `refType` pour celles dont la cible se déduit, et laisse les autres sans lien.
-- Aucun DROP, aucun ALTER COLUMN, aucune donnée touchée.

ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "url" TEXT;
