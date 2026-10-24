-- ════════════════════════════════════════════════════════════════════════════
-- ADMINISTRATION : HISTORIQUE DU RAPPORT D'IMPACT ET TÉMOIGNAGES CITABLES
-- ════════════════════════════════════════════════════════════════════════════
--
-- DÉCISION DU PORTEUR (« il faut tout conserver ») :
--
--   · `impact_report_snapshots` garde UN INSTANTANÉ PAR TRIMESTRE ET PAR RÉVISION.
--     Un recalcul pose une révision de plus ; la précédente n'est jamais écrasée
--     (aucun chemin de code ne fait d'UPDATE ni de DELETE sur cette table).
--   · `guides.quotable` et `city_tips.quotable` (15 §6, « Ajoutées ») : l'accord de
--     l'auteur pour qu'on cite son contenu dans le rapport. FAUX par défaut : citer
--     sans accord est ce que la colonne existe pour empêcher.
--   · `impact_quotes` : la citation MODÉRÉE — l'extrait que l'équipe approuve, pour
--     un trimestre, à partir d'un contenu dont l'auteur a donné son accord. Elle
--     disparaît avec le contenu (CASCADE) et ne s'affiche plus si l'accord est retiré.
--
-- STRICTEMENT ADDITIVE ET REJOUABLE : IF NOT EXISTS partout, clés étrangères dans
-- des blocs gardés. Aucun DROP, aucun ALTER COLUMN, aucune donnée modifiée. Le
-- RATTRAPAGE final range dans la nouvelle table les trimestres déjà calculés par
-- `impact.quarterly_prepare` (ils vivent dans `metric_snapshots`, en ajout seul) :
-- rien de ce qui a été calculé n'est perdu.

ALTER TABLE "guides"    ADD COLUMN IF NOT EXISTS "quotable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "city_tips" ADD COLUMN IF NOT EXISTS "quotable" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "impact_report_snapshots" (
  "id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "quarter" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "period_start" TIMESTAMPTZ NOT NULL,
  "period_end" TIMESTAMPTZ NOT NULL,
  "items" JSONB NOT NULL,
  "computed_by_staff_id" UUID,
  CONSTRAINT "impact_report_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "impact_report_snapshots_quarter_revision_key"
  ON "impact_report_snapshots"("quarter", "revision");
CREATE INDEX IF NOT EXISTS "impact_report_snapshots_period_start_idx"
  ON "impact_report_snapshots"("period_start");

CREATE TABLE IF NOT EXISTS "impact_quotes" (
  "id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "quarter" TEXT NOT NULL,
  "guide_id" UUID,
  "city_tip_id" UUID,
  "city_id" UUID,
  "quote" TEXT NOT NULL,
  "approved_by_staff_id" UUID,
  "withdrawn_at" TIMESTAMPTZ,
  CONSTRAINT "impact_quotes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "impact_quotes_une_source" CHECK (("guide_id" IS NULL) <> ("city_tip_id" IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS "impact_quotes_quarter_guide_id_key" ON "impact_quotes"("quarter", "guide_id");
CREATE UNIQUE INDEX IF NOT EXISTS "impact_quotes_quarter_city_tip_id_key" ON "impact_quotes"("quarter", "city_tip_id");
CREATE INDEX IF NOT EXISTS "impact_quotes_quarter_idx" ON "impact_quotes"("quarter");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'impact_report_snapshots_computed_by_staff_id_fkey') THEN
    ALTER TABLE "impact_report_snapshots" ADD CONSTRAINT "impact_report_snapshots_computed_by_staff_id_fkey"
      FOREIGN KEY ("computed_by_staff_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'impact_quotes_guide_id_fkey') THEN
    ALTER TABLE "impact_quotes" ADD CONSTRAINT "impact_quotes_guide_id_fkey"
      FOREIGN KEY ("guide_id") REFERENCES "guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'impact_quotes_city_tip_id_fkey') THEN
    ALTER TABLE "impact_quotes" ADD CONSTRAINT "impact_quotes_city_tip_id_fkey"
      FOREIGN KEY ("city_tip_id") REFERENCES "city_tips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'impact_quotes_city_id_fkey') THEN
    ALTER TABLE "impact_quotes" ADD CONSTRAINT "impact_quotes_city_id_fkey"
      FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'impact_quotes_approved_by_staff_id_fkey') THEN
    ALTER TABLE "impact_quotes" ADD CONSTRAINT "impact_quotes_approved_by_staff_id_fkey"
      FOREIGN KEY ("approved_by_staff_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- RATTRAPAGE : un instantané (révision 1) par trimestre déjà calculé dans
-- `metric_snapshots`. Le libellé reprend `quarterLabel` : « AAAA-TN ».
INSERT INTO "impact_report_snapshots" ("id", "quarter", "revision", "period_start", "period_end", "items")
SELECT gen_random_uuid(),
       to_char(m.period_start AT TIME ZONE 'UTC', 'YYYY') || '-T' || (((extract(month FROM m.period_start AT TIME ZONE 'UTC'))::int - 1) / 3 + 1)::text,
       1,
       m.period_start,
       m.period_start + interval '3 months',
       jsonb_agg(jsonb_build_object('metric', m.metric, 'dimension', m.dimension, 'value', m.value::float8)
                 ORDER BY m.metric, m.dimension)
  FROM "metric_snapshots" m
 WHERE m.metric LIKE 'impact.%'
 GROUP BY m.period_start
HAVING NOT EXISTS (
  SELECT 1 FROM "impact_report_snapshots" s
   WHERE s.quarter = to_char(m.period_start AT TIME ZONE 'UTC', 'YYYY') || '-T' || (((extract(month FROM m.period_start AT TIME ZONE 'UTC'))::int - 1) / 3 + 1)::text
);
