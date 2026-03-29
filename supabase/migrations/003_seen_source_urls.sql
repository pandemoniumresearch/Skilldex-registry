-- Tracks source_urls that were fetched but skipped due to name conflicts.
-- Prevents the seed script from re-fetching them on every run.
CREATE TABLE IF NOT EXISTS seen_source_urls (
  url TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
