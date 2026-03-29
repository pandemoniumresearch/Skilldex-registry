-- Watched repos table — source of truth for which repos the nightly
-- sync Action scans. Admins add/remove rows here; no code changes needed.

CREATE TABLE watched_repos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner           text NOT NULL,
  repo            text NOT NULL,
  branch          text NOT NULL DEFAULT 'main',
  trust_tier      text NOT NULL CHECK (trust_tier IN ('verified', 'community')),
  tags            text[] DEFAULT '{}',
  enabled         boolean DEFAULT true,
  notes           text,
  added_at        timestamptz DEFAULT now(),
  last_scanned_at timestamptz,
  UNIQUE (owner, repo)
);

-- Initial repos
INSERT INTO watched_repos (owner, repo, branch, trust_tier, tags, notes) VALUES
  ('anthropics',      'skills',                     'main', 'verified',  ARRAY['official'],  'Official Anthropic skill library'),
  ('ComposioHQ',      'awesome-claude-skills',      'main', 'community', ARRAY['composio'],  'Composio integration skills'),
  ('sickn33',         'antigravity-awesome-skills', 'main', 'community', '{}',               'Antigravity community skills'),
  ('alirezarezvani',  'claude-skills',              'main', 'community', '{}',               'Alireza Rezvani community skills');
