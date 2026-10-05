-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('TUTOR', 'PROFESSIONAL', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'BLOCKED', 'DELETION_PENDING', 'DELETED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SlotStatus" AS ENUM ('AVAILABLE', 'BOOKED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('CONFIRMED', 'CANCELLED_BY_TUTOR', 'CANCELLED_BY_PROVIDER', 'COMPLETED');

-- CreateEnum
CREATE TYPE "Modality" AS ENUM ('IN_PERSON', 'REMOTE');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'PUBLISHED', 'ENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SourceStatus" AS ENUM ('VALID', 'UNREACHABLE', 'OUTDATED', 'NOT_CHECKED');

-- CreateEnum
CREATE TYPE "PetSex" AS ENUM ('MALE', 'FEMALE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL');

-- CreateEnum
CREATE TYPE "VerificationTarget" AS ENUM ('CLINIC', 'PROFESSIONAL');

-- CreateEnum
CREATE TYPE "VerificationRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('CRMV', 'IDENTITY', 'CLINIC_LICENSE', 'OTHER');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'TUTOR',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "species" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "species_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pets" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "species_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "breed" TEXT,
    "sex" "PetSex" NOT NULL DEFAULT 'UNKNOWN',
    "birth_date" DATE,
    "weight_grams" INTEGER,
    "photo_path" TEXT,
    "notes" TEXT,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_acceptances" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "document" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "accepted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "privacy_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "privacy_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "user_id" UUID NOT NULL,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "appointment_reminders" BOOLEAN NOT NULL DEFAULT true,
    "campaign_updates" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "clinics" (
    "id" UUID NOT NULL,
    "owner_id" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "phone" TEXT,
    "address_line" TEXT NOT NULL,
    "neighborhood" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "responsible_vet" TEXT,
    "responsible_crmv" TEXT,
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "public_profile" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "clinics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professionals" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "display_name" TEXT NOT NULL,
    "specialty" TEXT,
    "bio" TEXT,
    "crmv_number" TEXT NOT NULL,
    "crmv_state" TEXT NOT NULL,
    "city" TEXT,
    "neighborhood" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "public_profile" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "professionals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_professionals" (
    "clinic_id" UUID NOT NULL,
    "professional_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinic_professionals_pkey" PRIMARY KEY ("clinic_id","professional_id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "modality" "Modality" NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "price_cents" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_species" (
    "service_id" UUID NOT NULL,
    "species_id" UUID NOT NULL,

    CONSTRAINT "service_species_pkey" PRIMARY KEY ("service_id","species_id")
);

-- CreateTable
CREATE TABLE "service_professionals" (
    "service_id" UUID NOT NULL,
    "professional_id" UUID NOT NULL,

    CONSTRAINT "service_professionals_pkey" PRIMARY KEY ("service_id","professional_id")
);

-- CreateTable
CREATE TABLE "availability_slots" (
    "id" UUID NOT NULL,
    "professional_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "clinic_id" UUID,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "SlotStatus" NOT NULL DEFAULT 'AVAILABLE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "availability_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_documents" (
    "id" UUID NOT NULL,
    "professional_id" UUID,
    "clinic_id" UUID,
    "kind" "DocumentKind" NOT NULL,
    "storage_path" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "tutor_id" UUID NOT NULL,
    "pet_id" UUID NOT NULL,
    "professional_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "clinic_id" UUID,
    "slot_id" UUID NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'CONFIRMED',
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "cancel_reason" TEXT,
    "cancelled_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "requirements" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "source_url" TEXT NOT NULL,
    "source_status" "SourceStatus" NOT NULL DEFAULT 'NOT_CHECKED',
    "source_checked_at" TIMESTAMPTZ(6),
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "verified_by_id" UUID,
    "verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "deduplication_key" TEXT NOT NULL,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "dedup_key" TEXT,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(6),

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_requests" (
    "id" UUID NOT NULL,
    "target" "VerificationTarget" NOT NULL,
    "professional_id" UUID,
    "clinic_id" UUID,
    "status" "VerificationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decided_by_id" UUID,
    "decided_at" TIMESTAMPTZ(6),
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "operation" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "response" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "species_slug_key" ON "species"("slug");

-- CreateIndex
CREATE INDEX "pets_owner_id_idx" ON "pets"("owner_id");

-- CreateIndex
CREATE INDEX "legal_acceptances_user_id_idx" ON "legal_acceptances"("user_id");

-- CreateIndex
CREATE INDEX "privacy_requests_user_id_idx" ON "privacy_requests"("user_id");

-- CreateIndex
CREATE INDEX "clinics_verification_status_city_neighborhood_idx" ON "clinics"("verification_status", "city", "neighborhood");

-- CreateIndex
CREATE UNIQUE INDEX "professionals_user_id_key" ON "professionals"("user_id");

-- CreateIndex
CREATE INDEX "professionals_verification_status_idx" ON "professionals"("verification_status");

-- CreateIndex
CREATE UNIQUE INDEX "professionals_crmv_number_crmv_state_key" ON "professionals"("crmv_number", "crmv_state");

-- CreateIndex
CREATE INDEX "services_active_modality_idx" ON "services"("active", "modality");

-- CreateIndex
CREATE INDEX "availability_slots_status_starts_at_idx" ON "availability_slots"("status", "starts_at");

-- CreateIndex
CREATE INDEX "availability_slots_professional_id_starts_at_idx" ON "availability_slots"("professional_id", "starts_at");

-- CreateIndex
CREATE INDEX "appointments_tutor_id_starts_at_idx" ON "appointments"("tutor_id", "starts_at");

-- CreateIndex
CREATE INDEX "appointments_professional_id_starts_at_idx" ON "appointments"("professional_id", "starts_at");

-- CreateIndex
CREATE INDEX "appointments_slot_id_idx" ON "appointments"("slot_id");

-- CreateIndex
CREATE INDEX "campaigns_status_ends_at_idx" ON "campaigns"("status", "ends_at");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_deduplication_key_key" ON "notifications"("deduplication_key");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_dedup_key_key" ON "outbox_events"("dedup_key");

-- CreateIndex
CREATE INDEX "outbox_events_status_next_attempt_at_idx" ON "outbox_events"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "verification_requests_status_created_at_idx" ON "verification_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_user_id_operation_key_key" ON "idempotency_keys"("user_id", "operation", "key");

-- AddForeignKey
ALTER TABLE "pets" ADD CONSTRAINT "pets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pets" ADD CONSTRAINT "pets_species_id_fkey" FOREIGN KEY ("species_id") REFERENCES "species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professionals" ADD CONSTRAINT "professionals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_professionals" ADD CONSTRAINT "clinic_professionals_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_professionals" ADD CONSTRAINT "clinic_professionals_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_species" ADD CONSTRAINT "service_species_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_species" ADD CONSTRAINT "service_species_species_id_fkey" FOREIGN KEY ("species_id") REFERENCES "species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_professionals" ADD CONSTRAINT "service_professionals_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_professionals" ADD CONSTRAINT "service_professionals_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "availability_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
