import { z } from "zod";

// --- Database row type ---

export interface SkillRow {
  id: string;
  name: string;
  description: string;
  author: string | null;
  source_url: string;
  trust_tier: "verified" | "community";
  score: number | null;
  spec_version: string;
  tags: string[] | null;
  install_count: number;
  published_at: string;
  updated_at: string;
  published_by: string | null;
}

// --- API response shape ---

export interface Skill {
  name: string;
  description: string;
  author: string | null;
  source_url: string;
  trust_tier: "verified" | "community";
  score: number | null;
  spec_version: string;
  tags: string[];
  install_count: number;
  published_at: string;
}

// --- Zod schemas ---

export const searchSkillsSchema = z.object({
  q: z.string().optional(),
  tier: z.enum(["verified", "community"]).optional(),
  min_score: z.coerce.number().int().min(0).max(100).optional(),
  spec_version: z.string().optional(),
  tags: z.string().optional(), // comma-separated
  sort: z.enum(["installs", "score", "recent", "name"]).default("installs"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type SearchSkillsQuery = z.infer<typeof searchSkillsSchema>;

export const createSkillSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "Name must be lowercase alphanumeric with hyphens"),
  source_url: z.string().url().startsWith("https://github.com/"),
  tags: z.array(z.string().min(1).max(50)).max(10).optional(),
});

export type CreateSkillBody = z.infer<typeof createSkillSchema>;

// --- Helpers ---

export function skillRowToApi(row: SkillRow): Skill {
  return {
    name: row.name,
    description: row.description,
    author: row.author,
    source_url: row.source_url,
    trust_tier: row.trust_tier,
    score: row.score,
    spec_version: row.spec_version,
    tags: row.tags ?? [],
    install_count: row.install_count,
    published_at: row.published_at,
  };
}
