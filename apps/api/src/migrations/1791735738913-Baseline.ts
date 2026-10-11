import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * The schema as it stood on 2026-10-11, when `synchronize` was switched off.
 * Generated from the entities against an empty database.
 *
 * Every database that existed before that day — production, every local dev
 * DB — already has exactly this schema, because `synchronize` built it from
 * the same entities on each boot. On those, this migration is recorded as run
 * and does nothing (the `users` check below). On an empty database it builds
 * everything.
 *
 * From here on every schema change is a new migration:
 *   npm run migration:generate -- src/migrations/<Name>   (against local Docker)
 */
export class Baseline1791735738913 implements MigrationInterface {
    name = 'Baseline1791735738913'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const [{ existing }] = await queryRunner.query(`SELECT to_regclass('public.users') IS NOT NULL AS existing`);
        if (existing) return; // schema already built by synchronize

        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE TYPE "public"."employers_subscriptiontier_enum" AS ENUM('NONE', 'STARTER', 'PRO', 'GROWTH', 'SCALE')`);
        await queryRunner.query(`CREATE TYPE "public"."employers_subscriptionstatus_enum" AS ENUM('INACTIVE', 'ACTIVE', 'PAST_DUE', 'CANCELLED')`);
        await queryRunner.query(`CREATE TABLE "employers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "companyName" character varying(255) NOT NULL, "nipc" character varying(9) NOT NULL, "nif" character varying(9), "sector" character varying(100), "address" character varying(512), "postalCode" character varying(8), "city" character varying(100), "logoUrl" character varying(512), "accountantEmail" character varying(255), "notificationPrefs" jsonb, "subscriptionTier" "public"."employers_subscriptiontier_enum" NOT NULL DEFAULT 'NONE', "isActive" boolean NOT NULL DEFAULT false, "lateCancellationCount" integer NOT NULL DEFAULT '0', "stripeCustomerId" character varying(255), "stripeSubscriptionId" character varying(255), "subscriptionStatus" "public"."employers_subscriptionstatus_enum" NOT NULL DEFAULT 'INACTIVE', "stripePaymentMethodId" character varying(255), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" uuid, CONSTRAINT "UQ_dcc4385773c2d2f42f0b1a8ddc2" UNIQUE ("nipc"), CONSTRAINT "REL_91fb7c4cd23362d14b79b72a6f" UNIQUE ("userId"), CONSTRAINT "PK_f2c1aea3e8d7aa3c5fba949c97d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('WORKER', 'EMPLOYER', 'ADMIN')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(255), "phone" character varying(20), "password" character varying(255), "googleId" character varying(255), "emailVerified" boolean NOT NULL DEFAULT false, "emailVerificationToken" character varying(255), "role" "public"."users_role_enum" NOT NULL, "termsVersion" character varying(20), "termsAcceptedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "UQ_a000cca60bcf04454e727699490" UNIQUE ("phone"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."workers_status_enum" AS ENUM('INCOMPLETE', 'PENDING_REVIEW', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'DELETED')`);
        await queryRunner.query(`CREATE TABLE "workers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "fullName" character varying(255), "dateOfBirth" date, "nif" character varying(9), "iban" character varying(34), "ibanShareConsentAt" TIMESTAMP, "photoUrl" character varying(512), "cvUrl" character varying(512), "cvFileName" character varying(255), "cvUploadedAt" TIMESTAMP, "bio" character varying(200), "skills" text, "languages" text, "isAvailableForWork" boolean NOT NULL DEFAULT true, "availableDays" text, "experiences" jsonb, "isVerified" boolean NOT NULL DEFAULT false, "status" "public"."workers_status_enum" NOT NULL DEFAULT 'INCOMPLETE', "deletedAt" TIMESTAMP, "profileQualityScore" integer NOT NULL DEFAULT '0', "reputationScore" integer NOT NULL DEFAULT '100', "avgRating" numeric(3,2), "totalRatings" integer NOT NULL DEFAULT '0', "noShowCount" integer NOT NULL DEFAULT '0', "badges" text, "lateCancellations" text, "suspendedUntil" TIMESTAMP, "isBlocked" boolean NOT NULL DEFAULT false, "restrictionReason" text, "restrictedAt" TIMESTAMP, "stripeAccountId" character varying(255), "expoPushToken" character varying(512), "preferredLanguage" character varying(5) NOT NULL DEFAULT 'pt', "completionRate" numeric(5,2) NOT NULL DEFAULT '0', "completedShifts" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" uuid, CONSTRAINT "REL_fdefd9252e90173f66271f76b9" UNIQUE ("userId"), CONSTRAINT "PK_e950c9aba3bd84a4f193058d838" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."shifts_status_enum" AS ENUM('DRAFT', 'OPEN', 'PENDING_ACCEPTANCE', 'FILLED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED')`);
        await queryRunner.query(`CREATE TABLE "shifts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(255) NOT NULL, "description" text NOT NULL, "category" character varying(100), "subcategory" character varying(100), "role" character varying(100), "date" date NOT NULL, "seriesId" uuid, "seriesDayIndex" integer, "seriesTotalDays" integer, "startTime" TIME NOT NULL, "endTime" TIME NOT NULL, "grossHourlyRate" numeric(6,2) NOT NULL, "address" character varying(255) NOT NULL, "lat" numeric(10,7), "lng" numeric(10,7), "status" "public"."shifts_status_enum" NOT NULL DEFAULT 'DRAFT', "offeredAt" TIMESTAMP WITH TIME ZONE, "archivedAt" TIMESTAMP WITH TIME ZONE, "skillsRequired" text, "languagesRequired" text, "hasDressCode" boolean NOT NULL DEFAULT false, "dressCode" character varying(300), "paymentMethod" character varying(20), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "employerId" uuid, "assignedWorkerId" uuid, CONSTRAINT "PK_84d692e367e4d6cdf045828768c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f4126725a07bbfdc07ae23ba83" ON "shifts" ("seriesId") `);
        await queryRunner.query(`CREATE TYPE "public"."shift_applications_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'EXPIRED', 'CANCELLED')`);
        await queryRunner.query(`CREATE TABLE "shift_applications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "status" "public"."shift_applications_status_enum" NOT NULL DEFAULT 'PENDING', "invited" boolean NOT NULL DEFAULT false, "coverNote" character varying(200), "employerSeenAt" TIMESTAMP, "appliedAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "shiftId" uuid, "workerId" uuid, CONSTRAINT "UQ_b6ba3dccfae4afdf6ca675f169f" UNIQUE ("shiftId", "workerId"), CONSTRAINT "PK_22b7572b4447b5d67ebe9035f64" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "ratings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "direction" character varying(30) NOT NULL DEFAULT 'EMPLOYER_TO_WORKER', "score" integer NOT NULL, "tags" text, "review" character varying(150), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "shiftId" uuid NOT NULL, "rater_id" uuid NOT NULL, "ratee_worker_id" uuid, "ratee_employer_id" uuid, CONSTRAINT "PK_0f31425b073219379545ad68ed9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_rating_shift_rater_dir" ON "ratings" ("shiftId", "rater_id", "direction") `);
        await queryRunner.query(`CREATE TABLE "no_show_flags" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "note" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "shiftId" uuid NOT NULL, "workerId" uuid NOT NULL, "reportedById" uuid NOT NULL, CONSTRAINT "PK_0edfca9759b69e25b06b3c5e731" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "favourite_workers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "employerId" uuid NOT NULL, "workerId" uuid NOT NULL, CONSTRAINT "PK_a104ab0831c2ee145a4673ae8b7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_favourite_employer_worker" ON "favourite_workers" ("employerId", "workerId") `);
        await queryRunner.query(`CREATE TYPE "public"."wage_payments_type_enum" AS ENUM('SHIFT_COMPLETION', 'CANCELLATION_MINIMUM')`);
        await queryRunner.query(`CREATE TYPE "public"."wage_payments_status_enum" AS ENUM('PENDING', 'PAID', 'MARKED_PAID', 'CONFIRMED', 'DISPUTED', 'UNDER_REVIEW', 'WAIVED')`);
        await queryRunner.query(`CREATE TABLE "wage_payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "shiftId" character varying NOT NULL, "employerId" character varying NOT NULL, "workerId" character varying NOT NULL, "type" "public"."wage_payments_type_enum" NOT NULL DEFAULT 'SHIFT_COMPLETION', "status" "public"."wage_payments_status_enum" NOT NULL DEFAULT 'PENDING', "amount" numeric(10,2) NOT NULL, "processingFee" numeric(10,2) NOT NULL DEFAULT '0', "stripeFeeActual" numeric(10,2), "netReceived" numeric(10,2), "paymentMethod" character varying(20) NOT NULL, "payLinkUrl" character varying(1024), "stripeCheckoutSessionId" character varying, "paymentProofUrl" character varying(512), "paymentProofNote" character varying(200), "paymentProofPurgedAt" TIMESTAMP, "cancellationReason" character varying(40), "cancellationNote" character varying(500), "paidAt" TIMESTAMP, "confirmedAt" TIMESTAMP, "remindersSent" integer NOT NULL DEFAULT '0', "shiftTitle" character varying(255) NOT NULL, "shiftDate" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c64f0b8bf215c8a31476e452592" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_62ea49683dadae3acd50efb9fa" ON "wage_payments" ("shiftId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c4b6533bc7e052e42b4bd07d87" ON "wage_payments" ("employerId", "status") `);
        await queryRunner.query(`CREATE TYPE "public"."payment_records_type_enum" AS ENUM('SHIFT_FEE', 'CANCELLATION_FEE', 'SUBSCRIPTION', 'SHIFT_CHARGE', 'WORKER_PAYOUT', 'WORKER_COMPENSATION')`);
        await queryRunner.query(`CREATE TYPE "public"."payment_records_status_enum" AS ENUM('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'CANCELLED')`);
        await queryRunner.query(`CREATE TABLE "payment_records" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "shiftId" character varying, "employerId" character varying, "workerId" character varying, "type" "public"."payment_records_type_enum" NOT NULL, "status" "public"."payment_records_status_enum" NOT NULL DEFAULT 'PENDING', "grossAmount" numeric(10,2) NOT NULL, "turnosFee" numeric(10,2) NOT NULL DEFAULT '0', "workerNet" numeric(10,2) NOT NULL DEFAULT '0', "employerTsu" numeric(10,2) NOT NULL DEFAULT '0', "workerTsu" numeric(10,2) NOT NULL DEFAULT '0', "scheduledHours" numeric(10,2) NOT NULL DEFAULT '0', "stripePaymentIntentId" character varying, "stripeTransferId" character varying, "stripeChargeId" character varying, "payslipUrl" character varying, "failureReason" text, "shiftDate" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1770b3d8261895c6bafd8faef91" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "worker_notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" character varying(40) NOT NULL, "messageKey" character varying(60), "params" jsonb, "title" character varying(160) NOT NULL, "body" text NOT NULL, "data" jsonb, "readAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "workerId" uuid, CONSTRAINT "PK_c84f8e6fa71691ab6cca8f25e3e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_53c7a7da2578c7523a0b85f777" ON "worker_notifications" ("workerId", "createdAt") `);
        await queryRunner.query(`CREATE TYPE "public"."compliance_audit_logs_event_enum" AS ENUM('CONTRACT_CREATED', 'SS_EMAIL_SENT', 'SS_SUBMITTED', 'SS_FAILED', 'SS_RETRY', 'DEPENDENCY_FLAG_40', 'DEPENDENCY_BLOCK_50', 'REST_PERIOD_VIOLATION_ATTEMPT', 'MCD_LIMIT_ATTEMPT', 'RECIBO_VERDE_REMINDER_SENT')`);
        await queryRunner.query(`CREATE TABLE "compliance_audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "event" "public"."compliance_audit_logs_event_enum" NOT NULL, "workerId" character varying, "employerId" character varying, "shiftId" character varying, "contractId" character varying, "details" jsonb NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d8fc162802a31ed9f4f3f8cb854" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."mcd_contracts_ssstatus_enum" AS ENUM('PENDING', 'EMAIL_SENT', 'SUBMITTED', 'FAILED')`);
        await queryRunner.query(`CREATE TABLE "mcd_contracts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workerName" character varying(255) NOT NULL, "workerNif" character varying(9) NOT NULL, "employerName" character varying(255) NOT NULL, "employerNipc" character varying(9) NOT NULL, "shiftDate" character varying(100) NOT NULL, "startTime" character varying(8) NOT NULL, "endTime" character varying(8) NOT NULL, "role" character varying(255), "grossHourlyRate" numeric(6,2) NOT NULL, "address" character varying(512) NOT NULL, "ssStatus" "public"."mcd_contracts_ssstatus_enum" NOT NULL DEFAULT 'PENDING', "ssAccountantEmail" character varying(255), "ssEmailSentAt" TIMESTAMP, "ssRetryCount" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "shiftId" uuid NOT NULL, "workerId" uuid NOT NULL, "employerId" uuid NOT NULL, CONSTRAINT "PK_0204093e5664be9280708c38d9b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."shift_attendance_status_enum" AS ENUM('PENDING', 'CHECKED_IN', 'COMPLETED', 'DISPUTED', 'MANUAL', 'NO_SHOW')`);
        await queryRunner.query(`CREATE TABLE "shift_attendance" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "checkInAt" TIMESTAMP, "checkInLat" numeric(10,6), "checkInLng" numeric(10,6), "checkOutAt" TIMESTAMP, "checkOutLat" numeric(10,6), "checkOutLng" numeric(10,6), "scheduledHours" numeric(5,2), "status" "public"."shift_attendance_status_enum" NOT NULL DEFAULT 'PENDING', "autoCompleted" boolean NOT NULL DEFAULT false, "isManualOverride" boolean NOT NULL DEFAULT false, "manualOverrideNote" character varying(512), "disputeNote" text, "disputeRaisedBy" character varying(10), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "shiftId" uuid NOT NULL, "workerId" uuid NOT NULL, CONSTRAINT "REL_aad9304ab8e6894e3b8ee914b4" UNIQUE ("shiftId"), CONSTRAINT "PK_feb4f05aefb39d787d6bdc21e50" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "employers" ADD CONSTRAINT "FK_91fb7c4cd23362d14b79b72a6f4" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "workers" ADD CONSTRAINT "FK_fdefd9252e90173f66271f76b96" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "shifts" ADD CONSTRAINT "FK_dacd8b44a79d80920a2897d4ea5" FOREIGN KEY ("employerId") REFERENCES "employers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "shifts" ADD CONSTRAINT "FK_826f210d8bfcd652e74c82ab9c7" FOREIGN KEY ("assignedWorkerId") REFERENCES "workers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "shift_applications" ADD CONSTRAINT "FK_88b39114b952bcf758057db097e" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "shift_applications" ADD CONSTRAINT "FK_aa61949823b9739bc5616bba446" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ratings" ADD CONSTRAINT "FK_fd4067c91c2a205ea6cab876dac" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ratings" ADD CONSTRAINT "FK_a5f23ba85e0f0d183b0a57476a8" FOREIGN KEY ("rater_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ratings" ADD CONSTRAINT "FK_46e3c9f62e080b27fe88c5f0ad5" FOREIGN KEY ("ratee_worker_id") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ratings" ADD CONSTRAINT "FK_566da9a7bd38880d105daeaf210" FOREIGN KEY ("ratee_employer_id") REFERENCES "employers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "no_show_flags" ADD CONSTRAINT "FK_78636c668a83ec2630c888a7ccc" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "no_show_flags" ADD CONSTRAINT "FK_2ed104aa09f5349a49d272537b7" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "no_show_flags" ADD CONSTRAINT "FK_96ad8a88bdcd33982bd850df821" FOREIGN KEY ("reportedById") REFERENCES "employers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "favourite_workers" ADD CONSTRAINT "FK_f3d479ef99ebbafcfe7ebb9f503" FOREIGN KEY ("employerId") REFERENCES "employers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "favourite_workers" ADD CONSTRAINT "FK_7611e9aadd353b078862841c66e" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "worker_notifications" ADD CONSTRAINT "FK_fbd31f923c4229099dbc1c9ad9d" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "mcd_contracts" ADD CONSTRAINT "FK_4ef33ad9071f0fd09c95c9b9893" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "mcd_contracts" ADD CONSTRAINT "FK_8dddc272f2d61a44636c1b82c09" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "mcd_contracts" ADD CONSTRAINT "FK_2e06dcb957f67ea131443d58521" FOREIGN KEY ("employerId") REFERENCES "employers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "shift_attendance" ADD CONSTRAINT "FK_aad9304ab8e6894e3b8ee914b4c" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "shift_attendance" ADD CONSTRAINT "FK_0176a07c822eef009023575d1eb" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "shift_attendance" DROP CONSTRAINT "FK_0176a07c822eef009023575d1eb"`);
        await queryRunner.query(`ALTER TABLE "shift_attendance" DROP CONSTRAINT "FK_aad9304ab8e6894e3b8ee914b4c"`);
        await queryRunner.query(`ALTER TABLE "mcd_contracts" DROP CONSTRAINT "FK_2e06dcb957f67ea131443d58521"`);
        await queryRunner.query(`ALTER TABLE "mcd_contracts" DROP CONSTRAINT "FK_8dddc272f2d61a44636c1b82c09"`);
        await queryRunner.query(`ALTER TABLE "mcd_contracts" DROP CONSTRAINT "FK_4ef33ad9071f0fd09c95c9b9893"`);
        await queryRunner.query(`ALTER TABLE "worker_notifications" DROP CONSTRAINT "FK_fbd31f923c4229099dbc1c9ad9d"`);
        await queryRunner.query(`ALTER TABLE "favourite_workers" DROP CONSTRAINT "FK_7611e9aadd353b078862841c66e"`);
        await queryRunner.query(`ALTER TABLE "favourite_workers" DROP CONSTRAINT "FK_f3d479ef99ebbafcfe7ebb9f503"`);
        await queryRunner.query(`ALTER TABLE "no_show_flags" DROP CONSTRAINT "FK_96ad8a88bdcd33982bd850df821"`);
        await queryRunner.query(`ALTER TABLE "no_show_flags" DROP CONSTRAINT "FK_2ed104aa09f5349a49d272537b7"`);
        await queryRunner.query(`ALTER TABLE "no_show_flags" DROP CONSTRAINT "FK_78636c668a83ec2630c888a7ccc"`);
        await queryRunner.query(`ALTER TABLE "ratings" DROP CONSTRAINT "FK_566da9a7bd38880d105daeaf210"`);
        await queryRunner.query(`ALTER TABLE "ratings" DROP CONSTRAINT "FK_46e3c9f62e080b27fe88c5f0ad5"`);
        await queryRunner.query(`ALTER TABLE "ratings" DROP CONSTRAINT "FK_a5f23ba85e0f0d183b0a57476a8"`);
        await queryRunner.query(`ALTER TABLE "ratings" DROP CONSTRAINT "FK_fd4067c91c2a205ea6cab876dac"`);
        await queryRunner.query(`ALTER TABLE "shift_applications" DROP CONSTRAINT "FK_aa61949823b9739bc5616bba446"`);
        await queryRunner.query(`ALTER TABLE "shift_applications" DROP CONSTRAINT "FK_88b39114b952bcf758057db097e"`);
        await queryRunner.query(`ALTER TABLE "shifts" DROP CONSTRAINT "FK_826f210d8bfcd652e74c82ab9c7"`);
        await queryRunner.query(`ALTER TABLE "shifts" DROP CONSTRAINT "FK_dacd8b44a79d80920a2897d4ea5"`);
        await queryRunner.query(`ALTER TABLE "workers" DROP CONSTRAINT "FK_fdefd9252e90173f66271f76b96"`);
        await queryRunner.query(`ALTER TABLE "employers" DROP CONSTRAINT "FK_91fb7c4cd23362d14b79b72a6f4"`);
        await queryRunner.query(`DROP TABLE "shift_attendance"`);
        await queryRunner.query(`DROP TYPE "public"."shift_attendance_status_enum"`);
        await queryRunner.query(`DROP TABLE "mcd_contracts"`);
        await queryRunner.query(`DROP TYPE "public"."mcd_contracts_ssstatus_enum"`);
        await queryRunner.query(`DROP TABLE "compliance_audit_logs"`);
        await queryRunner.query(`DROP TYPE "public"."compliance_audit_logs_event_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_53c7a7da2578c7523a0b85f777"`);
        await queryRunner.query(`DROP TABLE "worker_notifications"`);
        await queryRunner.query(`DROP TABLE "payment_records"`);
        await queryRunner.query(`DROP TYPE "public"."payment_records_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."payment_records_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c4b6533bc7e052e42b4bd07d87"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_62ea49683dadae3acd50efb9fa"`);
        await queryRunner.query(`DROP TABLE "wage_payments"`);
        await queryRunner.query(`DROP TYPE "public"."wage_payments_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."wage_payments_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_favourite_employer_worker"`);
        await queryRunner.query(`DROP TABLE "favourite_workers"`);
        await queryRunner.query(`DROP TABLE "no_show_flags"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_rating_shift_rater_dir"`);
        await queryRunner.query(`DROP TABLE "ratings"`);
        await queryRunner.query(`DROP TABLE "shift_applications"`);
        await queryRunner.query(`DROP TYPE "public"."shift_applications_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f4126725a07bbfdc07ae23ba83"`);
        await queryRunner.query(`DROP TABLE "shifts"`);
        await queryRunner.query(`DROP TYPE "public"."shifts_status_enum"`);
        await queryRunner.query(`DROP TABLE "workers"`);
        await queryRunner.query(`DROP TYPE "public"."workers_status_enum"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
        await queryRunner.query(`DROP TABLE "employers"`);
        await queryRunner.query(`DROP TYPE "public"."employers_subscriptionstatus_enum"`);
        await queryRunner.query(`DROP TYPE "public"."employers_subscriptiontier_enum"`);
    }

}
