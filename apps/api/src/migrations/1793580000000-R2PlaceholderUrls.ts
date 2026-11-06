import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Files uploaded while the R2 variables were set but the old storage code was
 * still running (2026-11-06): the object went into the bucket, but the saved
 * address was the old code's fallback `https://pub-placeholder.r2.dev/<key>`,
 * which doesn't exist. Since then files are served by the API at
 * `$API_URL/uploads/<key>`, so rewrite those addresses — the keys are the same.
 *
 * Data only, idempotent (nothing matches a second time). Skipped with a log
 * line if API_URL is unset, rather than writing a wrong address.
 */
const PLACEHOLDER = 'https://pub-placeholder.r2.dev';

export class R2PlaceholderUrls1793580000000 implements MigrationInterface {
    name = 'R2PlaceholderUrls1793580000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const apiUrl = (process.env['API_URL'] ?? '').replace(/\/+$/, '');
        if (!apiUrl) {
            console.warn('[R2PlaceholderUrls] API_URL unset — placeholder file addresses left as they are');
            return;
        }
        const target = `${apiUrl}/uploads`;
        const columns: Array<[string, string]> = [
            ['workers', 'photoUrl'],
            ['workers', 'cvUrl'],
            ['employers', 'logoUrl'],
            ['wage_payments', 'paymentProofUrl'],
        ];
        for (const [table, column] of columns) {
            await queryRunner.query(
                `UPDATE "${table}" SET "${column}" = replace("${column}", $1, $2) WHERE "${column}" LIKE $3`,
                [PLACEHOLDER, target, `${PLACEHOLDER}/%`],
            );
        }
        // Licence documents sit inside the roles jsonb
        await queryRunner.query(
            `UPDATE "workers" SET "roles" = replace("roles"::text, $1, $2)::jsonb WHERE "roles"::text LIKE $3`,
            [PLACEHOLDER, target, `%${PLACEHOLDER}/%`],
        );
    }

    public async down(): Promise<void> {
        // Nothing to undo: the placeholder addresses never worked.
    }

}
