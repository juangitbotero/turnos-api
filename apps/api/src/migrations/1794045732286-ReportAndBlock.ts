import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Report a shift / block a company (App Store guideline 1.2, 2026-11-07):
 * `shift_reports` (one per worker per shift) and `workers.blockedEmployerIds`.
 * Schema only.
 */

export class ReportAndBlock1794045732286 implements MigrationInterface {
    name = 'ReportAndBlock1794045732286'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "shift_reports" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "reason" character varying(30) NOT NULL, "note" character varying(500), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "shiftId" uuid, "workerId" uuid, CONSTRAINT "PK_808f8755e3b47b0c9327f750205" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_9c5ca7a0388048c41f3974924c" ON "shift_reports" ("shiftId", "workerId") `);
        await queryRunner.query(`ALTER TABLE "workers" ADD "blockedEmployerIds" jsonb NOT NULL DEFAULT '[]'`);
        await queryRunner.query(`ALTER TABLE "shift_reports" ADD CONSTRAINT "FK_d05ec5ca60733dbd8d2871296f5" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "shift_reports" ADD CONSTRAINT "FK_e2bc95b7a87565762e7a567f501" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "shift_reports" DROP CONSTRAINT "FK_e2bc95b7a87565762e7a567f501"`);
        await queryRunner.query(`ALTER TABLE "shift_reports" DROP CONSTRAINT "FK_d05ec5ca60733dbd8d2871296f5"`);
        await queryRunner.query(`ALTER TABLE "workers" DROP COLUMN "blockedEmployerIds"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9c5ca7a0388048c41f3974924c"`);
        await queryRunner.query(`DROP TABLE "shift_reports"`);
    }

}
