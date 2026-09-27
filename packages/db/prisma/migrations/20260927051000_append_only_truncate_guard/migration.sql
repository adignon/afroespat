-- Les déclencheurs BEFORE UPDATE OR DELETE ... FOR EACH ROW ne protègent PAS
-- contre TRUNCATE, qui ne produit aucune ligne. Un TRUNCATE effacerait donc les
-- 5 ans de journal d'audit exigés par §8.4 sans rien déclencher.
--
-- TRUNCATE se garde par un déclencheur de niveau instruction. Découvert en
-- essayant de violer la contrainte, pas en la relisant.
CREATE OR REPLACE FUNCTION forbid_truncate() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'table % est en ajout seul : TRUNCATE interdit', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_no_truncate
  BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_truncate();

CREATE TRIGGER moderation_actions_no_truncate
  BEFORE TRUNCATE ON moderation_actions
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_truncate();
