import { MigrationInterface, QueryRunner } from "typeorm";
import {
  deriveRolesFromLegacy, normalizeSkill, roleCategory,
  type WorkerExperience,
} from "@turnos/shared";

/**
 * Role catalogue (2026-10-25, docs/skills-matching-proposal.md).
 *
 * Schema: `workers.roles` (jsonb), `shifts.requiredLevel` + `shifts.tasksRequired`,
 * `ratings.levelMatched`.
 *
 * Data, one-off for rows that already exist:
 *  - each worker's old `skills` + `experiences` become provisional `roles`
 *    (renamed titles through the aliases, retired ones dropped, level guessed
 *    from the years bucket) — the app asks the worker to confirm them;
 *  - each shift's `subcategory` moves to its current name, its `category` to
 *    the new role family, and `skillsRequired` to just the role.
 * Uses the shared helpers on purpose: the data step only ever runs against
 * rows written before this release.
 */
export class RoleCatalogue1792933340835 implements MigrationInterface {
    name = 'RoleCatalogue1792933340835'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workers" ADD "roles" jsonb`);
        await queryRunner.query(`ALTER TABLE "shifts" ADD "requiredLevel" smallint NOT NULL DEFAULT '1'`);
        await queryRunner.query(`ALTER TABLE "shifts" ADD "tasksRequired" text`);
        await queryRunner.query(`ALTER TABLE "ratings" ADD "levelMatched" boolean`);

        const workers: { id: string; skills: string | null; experiences: WorkerExperience[] | null }[] =
            await queryRunner.query(`SELECT id, skills, experiences FROM "workers"`);
        for (const w of workers) {
            const skills = w.skills ? w.skills.split(',').filter(Boolean) : [];
            const roles = deriveRolesFromLegacy(skills, w.experiences);
            if (!roles.length) continue;
            await queryRunner.query(
                `UPDATE "workers" SET "roles" = $1::jsonb, "skills" = $2 WHERE id = $3`,
                [JSON.stringify(roles), roles.map(r => r.role).join(','), w.id],
            );
        }

        const shifts: { id: string; subcategory: string | null }[] =
            await queryRunner.query(`SELECT id, subcategory FROM "shifts" WHERE subcategory IS NOT NULL`);
        for (const s of shifts) {
            const role = normalizeSkill(s.subcategory!);
            const category = roleCategory(role);
            if (!category) continue; // retired title: leave the row as it was
            await queryRunner.query(
                // Separate parameters: varchar and text columns can't share one
                `UPDATE "shifts" SET subcategory = $1, category = $2, "skillsRequired" = $3 WHERE id = $4`,
                [role, category, role, s.id],
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // The renamed subcategory/category/skills values are not restored —
        // LEGACY_SKILL_ALIASES keeps both spellings readable either way.
        await queryRunner.query(`ALTER TABLE "ratings" DROP COLUMN "levelMatched"`);
        await queryRunner.query(`ALTER TABLE "shifts" DROP COLUMN "tasksRequired"`);
        await queryRunner.query(`ALTER TABLE "shifts" DROP COLUMN "requiredLevel"`);
        await queryRunner.query(`ALTER TABLE "workers" DROP COLUMN "roles"`);
    }
}
