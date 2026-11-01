import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Shifts nobody scanned (2026-11-01): the "to confirm" columns and the
 * check-in reminder counter on `shifts`. Schema only — existing FILLED shifts
 * are picked up by the 15-minute sweep, which treats anything that ended more
 * than UNCONFIRMED_BACKFILL_DAYS ago as legacy (no auto-completion, no push).
 */

export class UnscannedShifts1793560000000 implements MigrationInterface {
    name = 'UnscannedShifts1793560000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "shifts" ADD "confirmRequestedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "shifts" ADD "autoConfirmAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "shifts" ADD "workerConfirmation" character varying(12)`);
        await queryRunner.query(`ALTER TABLE "shifts" ADD "noShowReportedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "shifts" ADD "checkInRemindersSent" smallint NOT NULL DEFAULT '0'`);
        // Shifts already reported as no-shows: mark them, so the sweep never
        // treats them as "to confirm".
        await queryRunner.query(`UPDATE "shifts" s SET "noShowReportedAt" = f."createdAt" FROM "no_show_flags" f WHERE f."shiftId" = s."id"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "shifts" DROP COLUMN "checkInRemindersSent"`);
        await queryRunner.query(`ALTER TABLE "shifts" DROP COLUMN "noShowReportedAt"`);
        await queryRunner.query(`ALTER TABLE "shifts" DROP COLUMN "workerConfirmation"`);
        await queryRunner.query(`ALTER TABLE "shifts" DROP COLUMN "autoConfirmAt"`);
        await queryRunner.query(`ALTER TABLE "shifts" DROP COLUMN "confirmRequestedAt"`);
    }

}
