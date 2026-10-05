CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- unaccent() é STABLE; o wrapper permite usá-lo em índices de expressão.
CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent', $1) $$;

CREATE INDEX "professionals_name_trgm_idx"
  ON "professionals" USING gin (lower(f_unaccent("display_name")) gin_trgm_ops);
CREATE INDEX "professionals_specialty_trgm_idx"
  ON "professionals" USING gin (lower(f_unaccent(coalesce("specialty", ''))) gin_trgm_ops);
CREATE INDEX "clinics_name_trgm_idx"
  ON "clinics" USING gin (lower(f_unaccent("name")) gin_trgm_ops);
CREATE INDEX "services_name_trgm_idx"
  ON "services" USING gin (lower(f_unaccent("name")) gin_trgm_ops);

CREATE INDEX "professionals_city_idx" ON "professionals" (lower(f_unaccent("city")));
CREATE INDEX "professionals_neighborhood_idx" ON "professionals" (lower(f_unaccent("neighborhood")));
CREATE INDEX "availability_slots_open_idx"
  ON "availability_slots" ("professional_id", "starts_at") WHERE "status" = 'AVAILABLE';
