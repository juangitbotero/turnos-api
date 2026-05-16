# =============================================================================
# Turnos Infrastructure — README
# =============================================================================

## Services

| Service | URL | Credentials |
|---|---|---|
| **PostgreSQL** | `localhost:5432` | user: `turnos` / pass: `turnos_dev_password` / db: `turnos_db` |
| **Redis** | `localhost:6379` | No password (dev only) |
| **pgAdmin** | http://localhost:5050 | email: `admin@turnos.app` / pass: `turnos_admin` |
| **Redis UI** | http://localhost:8085 | No login required (dev only) |

## Commands

```bash
# Start all services (from repo root)
npm run db:start

# Stop all services
npm run db:stop

# View logs
npm run db:logs

# Wipe all data and restart fresh
npm run db:reset

# Connect to PostgreSQL directly
npm run db:psql
```

## Connection string (for NestJS / TypeORM / Prisma)

```
postgresql://turnos:turnos_dev_password@localhost:5432/turnos_db
```

## PostGIS

PostGIS is enabled automatically on first start via `infra/postgres/init.sql`.

Verify it's working:
```sql
SELECT PostGIS_Version();
-- Returns: 3.4 USE_GEOS=1 USE_PROJ=1 USE_STATS=1
```

## Redis

Redis is configured with:
- **AOF persistence** — every write is durable
- **256MB memory limit** — LRU eviction when full
- **Keyspace notifications** — required for BullMQ job queues (Stint 4+)

## Data Volumes

Data is stored in named Docker volumes (survives container restarts):
- `turnos_postgres_data`
- `turnos_redis_data`
- `turnos_pgadmin_data`

To list: `docker volume ls | grep turnos`
To wipe: `npm run db:reset`
