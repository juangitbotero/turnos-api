import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * "Shifts waiting for you" reminder (2026-11-17): when the worker last opened
 * the app, and when / how often they were last reminded. Schema only.
 */

export class WorkerReengagement1794900000000 implements MigrationInterface {
    name = 'WorkerReengagement1794900000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workers" ADD "lastActiveAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "workers" ADD "reengagementSentAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "workers" ADD "reengagementCount" smallint NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workers" DROP COLUMN "reengagementCount"`);
        await queryRunner.query(`ALTER TABLE "workers" DROP COLUMN "reengagementSentAt"`);
        await queryRunner.query(`ALTER TABLE "workers" DROP COLUMN "lastActiveAt"`);
    }

}
