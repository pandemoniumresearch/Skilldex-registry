/**
 * Seed script for Skilldex Registry.
 *
 * Seeds the registry with:
 * 1. The skilldex-official publisher account
 * 2. Spec version v1.0 (current)
 * 3. Known Anthropic official skills (verified tier)
 *
 * Usage: npm run seed
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
 */

import { createClient } from "@supabase/supabase-js";
import { fetchSkillFromGitHub } from "../src/github/fetch.js";
import { validateSkill } from "../src/validator/index.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Known skill sources to seed
// Add entries here as official and community skills become available
const SEED_SKILLS: Array<{
  source_url: string;
  trust_tier: "verified" | "community";
  tags: string[];
}> = [
  // Example entries — replace with real Anthropic skill repos when available:
  // {
  //   source_url: "https://github.com/anthropics/skill-code-review",
  //   trust_tier: "verified",
  //   tags: ["code-review", "analysis"],
  // },
];

async function seed() {
  console.log("Seeding Skilldex Registry...\n");

  // 1. Seed spec versions
  console.log("Seeding spec versions...");
  const { error: specError } = await supabase.from("spec_versions").upsert(
    [
      {
        version: "1.0",
        released_at: "2026-03-26T00:00:00.000Z",
        changelog_url: null,
        is_current: true,
      },
    ],
    { onConflict: "version" }
  );
  if (specError) {
    console.error("Failed to seed spec versions:", specError.message);
  } else {
    console.log("  ✓ spec_versions seeded (v1.0 = current)");
  }

  // 2. Create the official publisher account
  console.log("\nSeeding official publisher...");
  const { data: publisher, error: pubError } = await supabase
    .from("publishers")
    .upsert(
      [
        {
          github_handle: "skilldex-official",
          email: null,
          verified: true,
        },
      ],
      { onConflict: "github_handle" }
    )
    .select("*")
    .single();

  if (pubError) {
    console.error("Failed to seed publisher:", pubError.message);
    return;
  }
  console.log(`  ✓ Publisher created: ${publisher.github_handle} (verified)`);

  // 3. Seed skills
  if (SEED_SKILLS.length === 0) {
    console.log("\nNo skill sources configured for seeding.");
    console.log("Add entries to SEED_SKILLS in scripts/seed.ts when ready.");
    console.log("\nDone!");
    return;
  }

  console.log(`\nSeeding ${SEED_SKILLS.length} skills...`);

  for (const entry of SEED_SKILLS) {
    try {
      console.log(`\n  Fetching: ${entry.source_url}`);
      const metadata = await fetchSkillFromGitHub(entry.source_url);

      const validation = validateSkill({
        skillMd: metadata.skillMd,
        files: metadata.files,
      });

      const { error } = await supabase.from("skills").upsert(
        [
          {
            name: metadata.name,
            description: metadata.description,
            author: metadata.author ?? "skilldex-official",
            source_url: entry.source_url,
            trust_tier: entry.trust_tier,
            score: validation.score,
            spec_version: metadata.spec_version,
            tags: entry.tags,
            published_by: publisher.id,
          },
        ],
        { onConflict: "name" }
      );

      if (error) {
        console.error(`  ✗ Failed to insert ${metadata.name}: ${error.message}`);
      } else {
        console.log(
          `  ✓ ${metadata.name} (${entry.trust_tier}, score: ${validation.score})`
        );
      }
    } catch (err: any) {
      console.error(`  ✗ Failed to process ${entry.source_url}: ${err.message}`);
    }
  }

  console.log("\nDone!");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
