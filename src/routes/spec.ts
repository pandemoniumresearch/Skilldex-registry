import { Hono } from "hono";
import { getSupabase } from "../db/client.js";
import type { SpecVersion } from "../types/api.js";

export const specRoutes = new Hono();

// GET /spec-versions — list all spec versions
specRoutes.get("/", async (c) => {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("spec_versions")
    .select("*")
    .order("released_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch spec versions: ${error.message}`);
  }

  return c.json({ versions: (data ?? []) as SpecVersion[] });
});

// GET /spec-versions/current — get the current spec version
specRoutes.get("/current", async (c) => {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("spec_versions")
    .select("*")
    .eq("is_current", true)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return c.json({ error: "No current spec version set", code: "NOT_FOUND" }, 404);
    }
    throw new Error(`Failed to fetch current spec version: ${error.message}`);
  }

  return c.json(data as SpecVersion);
});
