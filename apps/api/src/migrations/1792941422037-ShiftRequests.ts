import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Multi-role requests ("Publicar vários turnos", 2026-10-25): the
 * `shift_requests` table and `shifts.requestId` / `shifts.lineId`. Schema only —
 * existing shifts stay single (both columns null).
 */

export class ShiftRequests1792941422037 implements MigrationInterface {
    name = 'ShiftRequests1792941422037'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "shift_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(120) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "employerId" uuid, CONSTRAINT "PK_70b460177bc127a3e8f659aac49" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "shifts" ADD "requestId" uuid`);
        await queryRunner.query(`ALTER TABLE "shifts" ADD "lineId" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_20e919db5b24081d3a2cdaa815" ON "shifts" ("requestId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9b25f393ad76f2023ff282b027" ON "shifts" ("lineId") `);
        await queryRunner.query(`ALTER TABLE "shift_requests" ADD CONSTRAINT "FK_480015862349dad978bf291e7ab" FOREIGN KEY ("employerId") REFERENCES "employers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "shift_requests" DROP CONSTRAINT "FK_480015862349dad978bf291e7ab"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9b25f393ad76f2023ff282b027"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_20e919db5b24081d3a2cdaa815"`);
        await queryRunner.query(`ALTER TABLE "shifts" DROP COLUMN "lineId"`);
        await queryRunner.query(`ALTER TABLE "shifts" DROP COLUMN "requestId"`);
        await queryRunner.query(`DROP TABLE "shift_requests"`);
    }

}
