import type { MiddlewareHandler } from "hono";
import { getSupabase } from "../db/client.js";
import { getPublisherById } from "../db/publishers.js";
import type { PublisherRow } from "../types/publisher.js";

// Extend Hono context with publisher
declare module "hono" {
  interface ContextVariableMap {
    publisher: PublisherRow;
  }
}

export const requireAuth: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid authorization header", code: "UNAUTHORIZED" }, 401);
  }

  const token = authHeader.slice(7);
  const supabase = getSupabase();

  // Verify the token with Supabase Auth
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return c.json({ error: "Invalid or expired token", code: "UNAUTHORIZED" }, 401);
  }

  // Look up the publisher by their Supabase user ID
  const publisher = await getPublisherById(user.id);

  if (!publisher) {
    return c.json({ error: "Publisher account not found", code: "UNAUTHORIZED" }, 401);
  }

  c.set("publisher", publisher);
  await next();
};
