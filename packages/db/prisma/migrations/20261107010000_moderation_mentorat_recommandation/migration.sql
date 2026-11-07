-- Étape 2 : les textes de parrainage et de recommandation entrent dans le pipeline de
-- modération. Additif et idempotent : quatre valeurs d'énumération.

ALTER TYPE "ReportSubjectType" ADD VALUE IF NOT EXISTS 'MENTORSHIP';
ALTER TYPE "ReportSubjectType" ADD VALUE IF NOT EXISTS 'MENTORSHIP_REVIEW';
ALTER TYPE "ReportSubjectType" ADD VALUE IF NOT EXISTS 'MENTOR_PROFILE';
ALTER TYPE "ReportSubjectType" ADD VALUE IF NOT EXISTS 'MEMBER_RECOMMENDATION';
