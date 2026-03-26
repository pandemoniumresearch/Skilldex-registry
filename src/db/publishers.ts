import { getSupabase } from "./client.js";
import type { PublisherRow } from "../types/publisher.js";

export async function getPublisherById(id: string): Promise<PublisherRow | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("publishers")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Database query failed: ${error.message}`);
  }

  return data as PublisherRow;
}

export async function getPublisherByGithubHandle(
  handle: string
): Promise<PublisherRow | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("publishers")
    .select("*")
    .eq("github_handle", handle)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Database query failed: ${error.message}`);
  }

  return data as PublisherRow;
}

export async function upsertPublisher(
  githubHandle: string,
  email: string | null
): Promise<PublisherRow> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("publishers")
    .upsert(
      { github_handle: githubHandle, email },
      { onConflict: "github_handle" }
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to upsert publisher: ${error.message}`);
  }

  return data as PublisherRow;
}
