CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "availability_slots"
  ADD CONSTRAINT "availability_slots_range_check" CHECK ("starts_at" < "ends_at"),
  ADD CONSTRAINT "availability_slots_no_overlap"
    EXCLUDE USING gist (
      "professional_id" WITH =,
      tstzrange("starts_at", "ends_at", '[)') WITH &&
    );

-- Um horário só pode ter um atendimento ativo; cancelados liberam o slot.
CREATE UNIQUE INDEX "appointments_active_slot_key"
  ON "appointments" ("slot_id")
  WHERE "status" IN ('CONFIRMED', 'COMPLETED');

ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_range_check" CHECK ("starts_at" < "ends_at");

ALTER TABLE "services"
  ADD CONSTRAINT "services_duration_check" CHECK ("duration_minutes" > 0),
  ADD CONSTRAINT "services_price_check" CHECK ("price_cents" IS NULL OR "price_cents" >= 0);

ALTER TABLE "campaigns"
  ADD CONSTRAINT "campaigns_period_check" CHECK ("starts_at" < "ends_at");

ALTER TABLE "pets"
  ADD CONSTRAINT "pets_weight_check" CHECK ("weight_grams" IS NULL OR "weight_grams" > 0);

ALTER TABLE "verification_documents"
  ADD CONSTRAINT "verification_documents_owner_check"
  CHECK (("professional_id" IS NOT NULL)::int + ("clinic_id" IS NOT NULL)::int = 1);

ALTER TABLE "verification_requests"
  ADD CONSTRAINT "verification_requests_target_check"
  CHECK (("professional_id" IS NOT NULL)::int + ("clinic_id" IS NOT NULL)::int = 1);
