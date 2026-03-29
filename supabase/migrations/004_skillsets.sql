-- Migration: add skillsets table
-- Skillsets are bundles of skills designed for a specific agent use-case.
-- skill_refs stores both embedded and remote skill references as JSONB.

CREATE TABLE IF NOT EXISTS skillsets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL UNIQUE
                  CONSTRAINT skillsets_name_format CHECK (name ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'),
  description   text NOT NULL DEFAULT '',
  author        text,
  source_url    text NOT NULL,
  trust_tier    text NOT NULL DEFAULT 'community'
                  CONSTRAINT skillsets_trust_tier_check CHECK (trust_tier IN ('verified', 'community')),
  score         integer CONSTRAINT skillsets_score_check CHECK (score BETWEEN 0 AND 100),
  spec_version  text NOT NULL DEFAULT '1.0',
  tags          text[],
  -- skill_refs: [{ name: string, source_url: string }]
  skill_refs    jsonb NOT NULL DEFAULT '[]'::jsonb,
  skill_count   integer GENERATED ALWAYS AS (jsonb_array_length(skill_refs)) STORED,
  install_count integer NOT NULL DEFAULT 0,
  published_at  timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  published_by  uuid REFERENCES publishers(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS skillsets_name_idx ON skillsets (name);
CREATE INDEX IF NOT EXISTS skillsets_tags_idx ON skillsets USING GIN (tags);
CREATE INDEX IF NOT EXISTS skillsets_trust_tier_idx ON skillsets (trust_tier);
CREATE INDEX IF NOT EXISTS skillsets_install_count_idx ON skillsets (install_count DESC);
CREATE INDEX IF NOT EXISTS skillsets_score_idx ON skillsets (score DESC);
CREATE INDEX IF NOT EXISTS skillsets_published_at_idx ON skillsets (published_at DESC);

-- Full-text search index (mirrors the skills table setup)
CREATE INDEX IF NOT EXISTS skillsets_fts_idx
  ON skillsets USING GIN (to_tsvector('english', name || ' ' || description));
