-- Clínicas que atendem urgência 24 horas (tela de emergência do app).
ALTER TABLE "clinics" ADD COLUMN "emergency_24h" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "clinics_emergency_24h_idx" ON "clinics" ("emergency_24h") WHERE "verification_status" = 'APPROVED';
