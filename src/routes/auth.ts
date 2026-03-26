import { Hono } from "hono";
import { getSupabase } from "../db/client.js";
import { upsertPublisher } from "../db/publishers.js";
import { requireAuth } from "../middleware/auth.js";

export const authRoutes = new Hono();

// GET /auth/github — initiate GitHub OAuth flow
authRoutes.get("/github", async (c) => {
  const supabase = getSupabase();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: `${getBaseUrl(c)}/v1/auth/github/callback`,
    },
  });

  if (error || !data.url) {
    return c.json(
      { error: "Failed to initiate OAuth flow", code: "AUTH_ERROR" },
      500
    );
  }

  return c.redirect(data.url);
});

// GET /auth/github/callback — handle GitHub OAuth callback
authRoutes.get("/github/callback", async (c) => {
  const code = c.req.query("code");

  if (!code) {
    return c.json(
      { error: "Missing authorization code", code: "INVALID_CALLBACK" },
      400
    );
  }

  const supabase = getSupabase();

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    return c.json(
      { error: "Failed to exchange code for session", code: "AUTH_ERROR" },
      400
    );
  }

  // Extract GitHub handle from user metadata
  const githubHandle =
    data.user.user_metadata?.user_name ??
    data.user.user_metadata?.preferred_username ??
    data.user.email?.split("@")[0] ??
    "unknown";

  const email = data.user.email ?? null;

  // Upsert publisher record
  const publisher = await upsertPublisher(githubHandle, email);

  return c.json({
    token: data.session.access_token,
    publisher: {
      github_handle: publisher.github_handle,
      verified: publisher.verified,
    },
  });
});

// GET /auth/me — get current authenticated publisher
authRoutes.get("/me", requireAuth, async (c) => {
  const publisher = c.get("publisher");

  return c.json({
    github_handle: publisher.github_handle,
    verified: publisher.verified,
  });
});

// --- Helpers ---

function getBaseUrl(c: any): string {
  const proto = c.req.header("x-forwarded-proto") || "http";
  const host = c.req.header("host") || "localhost:3000";
  return `${proto}://${host}`;
}
