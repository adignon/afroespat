-- ─────────────────────────────────────────────────────────────────────────────
-- Contraintes que Prisma n'exprime pas, et qui portent des règles dures.
-- Écrites à la main, volontairement : une règle dure tenue par la base ne peut
-- pas être contournée par un bogue de service.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Recherche full-text française, insensible aux accents (module 11).
--
--    unaccent() est déclarée STABLE, pas IMMUTABLE, parce qu'elle dépend d'un
--    dictionnaire qu'un administrateur pourrait remplacer. PostgreSQL refuse donc
--    de l'employer dans une expression d'index. L'enveloppe ci-dessous fixe le
--    dictionnaire explicitement, ce qui rend l'appel réellement déterministe :
--    c'est la solution documentée. Contrepartie assumée — si le dictionnaire
--    unaccent change, il faut réindexer (runbook §7 le prévoit déjà).
CREATE FUNCTION immutable_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS
$$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

--    Le tsvector est maintenu par déclencheur plutôt que par colonne générée :
--    cela permet de pondérer le titre (A) plus fort que le corps (B).
CREATE OR REPLACE FUNCTION search_documents_tsv_update() RETURNS trigger AS $$
BEGIN
  NEW.tsv :=
      setweight(to_tsvector('french', immutable_unaccent(coalesce(NEW.title, ''))), 'A')
   || setweight(to_tsvector('french', immutable_unaccent(coalesce(NEW.body_text, ''))), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER search_documents_tsv
  BEFORE INSERT OR UPDATE OF title, body_text ON search_documents
  FOR EACH ROW EXECUTE FUNCTION search_documents_tsv_update();

CREATE INDEX search_documents_tsv_idx ON search_documents USING GIN (tsv);

-- Recherche approximative sur les titres (pg_trgm) : rattrape les fautes de frappe.
CREATE INDEX search_documents_title_trgm_idx
  ON search_documents USING GIN (immutable_unaccent(title) gin_trgm_ops);

-- 2. connections : paire ordonnée. Garantit qu'un contact n'existe qu'une fois,
--    dans un seul sens (00-fondations.md §6.3, module 08).
ALTER TABLE connections
  ADD CONSTRAINT connections_ordered_pair CHECK (user_a_id < user_b_id);

-- 3. On ne se bloque pas soi-même, on ne se parraine pas soi-même.
ALTER TABLE blocks
  ADD CONSTRAINT blocks_not_self CHECK (blocker_user_id <> blocked_user_id);
ALTER TABLE mentorships
  ADD CONSTRAINT mentorships_not_self CHECK (mentor_user_id <> mentee_user_id);
ALTER TABLE connection_requests
  ADD CONSTRAINT connection_requests_not_self CHECK (from_user_id <> to_user_id);

-- 4. RÈGLE DURE (03 §2.2) : une seule version PUBLISHED par (type, pays d'origine).
--    Deux index partiels : PostgreSQL traite NULL comme distinct dans un index
--    unique, donc la version générique (origin_country_id NULL) a besoin du sien.
CREATE UNIQUE INDEX journey_template_versions_one_published_per_country
  ON journey_template_versions (template_id, origin_country_id)
  WHERE status = 'PUBLISHED' AND origin_country_id IS NOT NULL;

CREATE UNIQUE INDEX journey_template_versions_one_published_generic
  ON journey_template_versions (template_id)
  WHERE status = 'PUBLISHED' AND origin_country_id IS NULL;

-- 5. RÈGLE DURE (§8.5, §7.4) : audit_logs est en AJOUT SEUL. Aucune route de
--    modification ni de suppression — et la base le refuse aussi, pour que la
--    garantie ne dépende pas du code applicatif.
CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'table % est en ajout seul : % interdit', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_append_only
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- moderation_actions est également en ajout seul (13 §4.2).
CREATE TRIGGER moderation_actions_append_only
  BEFORE UPDATE OR DELETE ON moderation_actions
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- 6. RÈGLE DURE (§1.2) : aucun état d'échec sur une étape. L'enum l'interdit déjà ;
--    cette contrainte protège en plus la cohérence des horodatages.
ALTER TABLE journey_steps
  ADD CONSTRAINT journey_steps_done_has_completed_at
  CHECK (status <> 'DONE' OR completed_at IS NOT NULL);

ALTER TABLE journey_steps
  ADD CONSTRAINT journey_steps_paused_has_paused_at
  CHECK (status <> 'PAUSED' OR paused_at IS NOT NULL);

-- 7. Montants : entiers positifs, jamais de flottant (§4).
ALTER TABLE housing_listings
  ADD CONSTRAINT housing_listings_price_positive CHECK (price_cents IS NULL OR price_cents >= 0);
ALTER TABLE payments
  ADD CONSTRAINT payments_amount_positive CHECK (amount_cents >= 0);
ALTER TABLE plans
  ADD CONSTRAINT plans_price_positive CHECK (price_cents >= 0);

-- 8. Bornes déclarées par les specs.
ALTER TABLE mentorship_reviews
  ADD CONSTRAINT mentorship_reviews_rating_range CHECK (rating BETWEEN 1 AND 5);
ALTER TABLE journeys
  ADD CONSTRAINT journeys_progress_range CHECK (progress_pct BETWEEN 0 AND 100);
ALTER TABLE moderation_cases
  ADD CONSTRAINT moderation_cases_priority_range CHECK (priority BETWEEN 1 AND 5);
ALTER TABLE feature_flags
  ADD CONSTRAINT feature_flags_rollout_range CHECK (rollout_pct BETWEEN 0 AND 100);
ALTER TABLE mentor_profiles
  ADD CONSTRAINT mentor_profiles_max_mentees_range CHECK (max_mentees BETWEEN 0 AND 5);

-- 9. Cohérence des réseaux automatiques (07) : CITY exige une ville, COUNTRY un pays.
ALTER TABLE communities
  ADD CONSTRAINT communities_kind_target CHECK (
    (kind = 'CITY'     AND city_id IS NOT NULL) OR
    (kind = 'COUNTRY'  AND country_id IS NOT NULL) OR
    (kind = 'INTEREST')
  );

-- 10. Un guide de portée COUNTRY doit porter son pays (05 §2).
ALTER TABLE guides
  ADD CONSTRAINT guides_country_scope CHECK (scope <> 'COUNTRY' OR origin_country_id IS NOT NULL);
