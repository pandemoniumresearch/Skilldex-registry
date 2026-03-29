import { getSupabase } from "./client.js";
import type { SkillsetRow } from "../types/skillset.js";
import type { SearchSkillsetsQuery } from "../types/skillset.js";

const SORT_MAP: Record<string, { column: string; ascending: boolean }> = {
  installs: { column: "install_count", ascending: false },
  score: { column: "score", ascending: false },
  recent: { column: "published_at", ascending: false },
  name: { column: "name", ascending: true },
};

export async function searchSkillsets(
  params: SearchSkillsetsQuery
): Promise<{ skillsets: SkillsetRow[]; total: number }> {
  const supabase = getSupabase();

  let query = supabase.from("skillsets").select("*", { count: "exact" });

  if (params.q) {
    query = query.textSearch("name, description", params.q, {
      type: "websearch",
      config: "english",
    });
  }

  if (params.tier) {
    query = query.eq("trust_tier", params.tier);
  }

  if (params.min_score !== undefined) {
    query = query.gte("score", params.min_score);
  }

  if (params.spec_version) {
    query = query.eq("spec_version", params.spec_version);
  }

  if (params.tags) {
    const tagList = params.tags.split(",").map((t) => t.trim());
    query = query.overlaps("tags", tagList);
  }

  const sort = SORT_MAP[params.sort] ?? SORT_MAP.installs;
  query = query.order(sort.column, { ascending: sort.ascending });

  query = query.range(params.offset, params.offset + params.limit - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Database query failed: ${error.message}`);
  }

  return {
    skillsets: (data ?? []) as SkillsetRow[],
    total: count ?? 0,
  };
}

export async function getSkillsetByName(name: string): Promise<SkillsetRow | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("skillsets")
    .select("*")
    .eq("name", name)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Database query failed: ${error.message}`);
  }

  return data as SkillsetRow;
}

export async function incrementSkillsetInstallCount(name: string): Promise<SkillsetRow | null> {
  const supabase = getSupabase();

  const skillset = await getSkillsetByName(name);
  if (!skillset) return null;

  const { data, error } = await supabase
    .from("skillsets")
    .update({ install_count: skillset.install_count + 1 })
    .eq("name", name)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to increment install count: ${error.message}`);
  }

  return data as SkillsetRow;
}

export async function createSkillset(
  skillset: Omit<SkillsetRow, "id" | "skill_count" | "install_count" | "published_at" | "updated_at">
): Promise<SkillsetRow> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("skillsets")
    .insert(skillset)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw Object.assign(new Error("Skillset name already exists"), { code: "CONFLICT" });
    }
    throw new Error(`Failed to create skillset: ${error.message}`);
  }

  return data as SkillsetRow;
}

export async function updateSkillset(
  name: string,
  updates: Partial<Pick<SkillsetRow, "description" | "score" | "spec_version" | "tags" | "source_url" | "skill_refs">>
): Promise<SkillsetRow | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("skillsets")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("name", name)
    .select("*")
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to update skillset: ${error.message}`);
  }

  return data as SkillsetRow;
}

export async function deleteSkillset(name: string): Promise<boolean> {
  const supabase = getSupabase();

  const { error, count } = await supabase
    .from("skillsets")
    .delete({ count: "exact" })
    .eq("name", name);

  if (error) {
    throw new Error(`Failed to delete skillset: ${error.message}`);
  }

  return (count ?? 0) > 0;
}
