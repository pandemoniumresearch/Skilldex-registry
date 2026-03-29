/**
 * Add a GitHub repo to the watched_repos table.
 *
 * Usage:
 *   npm run add-repo -- <github-url> <verified|community> [options]
 *
 * Options:
 *   --tags "tag1,tag2"   Comma-separated tags
 *   --notes "some note"  Admin notes
 *   --branch <branch>    Branch to scan (default: main)
 *
 * Examples:
 *   npm run add-repo -- https://github.com/owner/repo community
 *   npm run add-repo -- https://github.com/owner/repo verified --tags "official" --notes "Anthropic partner"
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function parseArgs() {
  const args = process.argv.slice(2);
  const url = args[0];
  const tier = args[1];

  if (!url || !tier) {
    console.error("Usage: npm run add-repo -- <github-url> <verified|community> [--tags ...] [--notes ...] [--branch ...]");
    process.exit(1);
  }

  if (tier !== "verified" && tier !== "community") {
    console.error('Trust tier must be "verified" or "community"');
    process.exit(1);
  }

  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
  };

  return {
    url,
    tier: tier as "verified" | "community",
    tags: get("--tags")?.split(",").map((t) => t.trim()).filter(Boolean) ?? [],
    notes: get("--notes") ?? null,
    branch: get("--branch") ?? "main",
  };
}

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const cleaned = url.replace(/\.git$/, "").replace(/\/$/, "");
    const u = new URL(cleaned);
    if (u.hostname !== "github.com") return null;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1] };
  } catch {
    return null;
  }
}

async function main() {
  const opts = parseArgs();
  const parsed = parseGitHubUrl(opts.url);

  if (!parsed) {
    console.error(`Invalid GitHub URL: ${opts.url}`);
    process.exit(1);
  }

  const { owner, repo } = parsed;

  const { data: existing } = await supabase
    .from("watched_repos")
    .select("id, enabled")
    .eq("owner", owner)
    .eq("repo", repo)
    .single();

  if (existing) {
    console.log(`Already watching ${owner}/${repo}`);
    process.exit(0);
  }

  const { error } = await supabase.from("watched_repos").insert({
    owner,
    repo,
    branch: opts.branch,
    trust_tier: opts.tier,
    tags: opts.tags,
    notes: opts.notes,
    enabled: true,
  });

  if (error) {
    console.error("Failed:", error.message);
    process.exit(1);
  }

  console.log(`✓ Added ${owner}/${repo}`);
  console.log(`  Tier:   ${opts.tier}`);
  console.log(`  Branch: ${opts.branch}`);
  if (opts.tags.length) console.log(`  Tags:   ${opts.tags.join(", ")}`);
  if (opts.notes)       console.log(`  Notes:  ${opts.notes}`);
  console.log(`\nPicked up on next nightly sync.`);
  console.log(`To sync now: GitHub Actions → Nightly skill sync → Run workflow`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
