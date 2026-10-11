/**
 * DataSource for the TypeORM CLI only — the app itself connects through
 * TypeOrmModule in app.module.ts. Same connection rules: DATABASE_URL when
 * set, else the DB_* variables of local dev.
 *
 *   npm run migration:generate -- src/migrations/AddSomething
 *   npm run migration:run
 *   npm run migration:revert
 *
 * Generate against the LOCAL Docker database, never production: the CLI diffs
 * the entities against whatever database it connects to.
 */
import 'reflect-metadata';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const url = process.env.DATABASE_URL;

export default new DataSource({
  type: 'postgres',
  ...(url
    ? { url, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false }
    : {
        host:     process.env.DB_HOST ?? 'localhost',
        port:     Number(process.env.DB_PORT ?? 5432),
        username: process.env.DB_USER ?? 'turnos',
        password: process.env.DB_PASSWORD ?? 'turnos_dev_password',
        database: process.env.DB_NAME ?? 'turnos_db',
      }),
  entities: [path.join(__dirname, '**', '*.entity.ts')],
  migrations: [path.join(__dirname, 'migrations', '*.ts')],
});
