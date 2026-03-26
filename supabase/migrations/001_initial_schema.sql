-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Publishers table
CREATE TABLE publishers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  github_handle   text NOT NULL UNIQUE,
  email           text,
  verified        boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

-- Skills table
CREATE TABLE skills (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL UNIQUE,
  description     text NOT NULL,
  author          text,
  source_url      text NOT NULL,
  trust_tier      text NOT NULL CHECK (trust_tier IN ('verified', 'community')),
  score           integer CHECK (score >= 0 AND score <= 100),
  spec_version    text NOT NULL,
  tags            text[],
  install_count   integer DEFAULT 0,
  published_at    timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  published_by    uuid REFERENCES publishers(id)
);

-- Spec versions table
CREATE TABLE spec_versions (
  version         text PRIMARY KEY,
  released_at     timestamptz,
  changelog_url   text,
  is_current      boolean DEFAULT false
);

-- Full-text search index on skills
CREATE INDEX skills_fts_idx ON skills
  USING GIN (to_tsvector('english', name || ' ' || coalesce(description, '')));

-- Trigram index for fuzzy search
CREATE INDEX skills_name_trgm_idx ON skills
  USING GIN (name gin_trgm_ops);

-- Index for common query patterns
CREATE INDEX skills_trust_tier_idx ON skills (trust_tier);
CREATE INDEX skills_install_count_idx ON skills (install_count DESC);
CREATE INDEX skills_score_idx ON skills (score DESC NULLS LAST);
CREATE INDEX skills_published_at_idx ON skills (published_at DESC);

-- Ensure only one spec version is current
CREATE UNIQUE INDEX spec_versions_current_idx ON spec_versions (is_current)
  WHERE is_current = true;
