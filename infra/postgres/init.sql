-- =============================================================================
-- Turnos DB — Initialization Script
-- Runs once on first container start
-- =============================================================================

-- Enable PostGIS extension (geospatial queries for proximity matching)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pg_trgm for fuzzy text search (worker/employer name search)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enable citext for case-insensitive email columns
CREATE EXTENSION IF NOT EXISTS citext;

-- =============================================================================
-- Verify extensions loaded correctly
-- =============================================================================
DO $$
BEGIN
  RAISE NOTICE 'PostGIS version: %', PostGIS_Version();
  RAISE NOTICE 'PostgreSQL version: %', version();
  RAISE NOTICE '✅ Turnos DB initialized successfully';
END $$;
