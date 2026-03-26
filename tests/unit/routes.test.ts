import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { healthRoutes } from "../../src/routes/health.js";

describe("Health route", () => {
  const app = new Hono();
  app.route("/health", healthRoutes);

  it("returns ok status", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ status: "ok", version: "1.0.0" });
  });
});

describe("Skills route input validation", () => {
  it("validates search params schema", async () => {
    const { searchSkillsSchema } = await import("../../src/types/skill.js");

    // Valid params
    const valid = searchSkillsSchema.safeParse({
      q: "forensics",
      tier: "verified",
      sort: "score",
      limit: "10",
      offset: "0",
    });
    expect(valid.success).toBe(true);

    // Invalid tier
    const invalidTier = searchSkillsSchema.safeParse({
      tier: "invalid",
    });
    expect(invalidTier.success).toBe(false);

    // Limit out of range
    const bigLimit = searchSkillsSchema.safeParse({
      limit: "100",
    });
    expect(bigLimit.success).toBe(false);
  });

  it("validates create skill schema", async () => {
    const { createSkillSchema } = await import("../../src/types/skill.js");

    // Valid body
    const valid = createSkillSchema.safeParse({
      name: "forensics-agent",
      source_url: "https://github.com/user/forensics-agent",
      tags: ["forensics"],
    });
    expect(valid.success).toBe(true);

    // Invalid name (uppercase)
    const invalidName = createSkillSchema.safeParse({
      name: "Forensics-Agent",
      source_url: "https://github.com/user/forensics-agent",
    });
    expect(invalidName.success).toBe(false);

    // Invalid source_url (not GitHub)
    const invalidUrl = createSkillSchema.safeParse({
      name: "forensics-agent",
      source_url: "https://gitlab.com/user/forensics-agent",
    });
    expect(invalidUrl.success).toBe(false);

    // Missing required fields
    const missing = createSkillSchema.safeParse({});
    expect(missing.success).toBe(false);
  });
});

describe("Rate limiter", () => {
  it("allows requests within limit", async () => {
    const { rateLimit } = await import("../../src/middleware/rateLimit.js");

    const app = new Hono();
    app.use("*", rateLimit({ max: 3, windowMs: 60_000 }));
    app.get("/", (c) => c.json({ ok: true }));

    // First 3 should pass
    for (let i = 0; i < 3; i++) {
      const res = await app.request("/");
      expect(res.status).toBe(200);
    }

    // 4th should be rate limited
    const res = await app.request("/");
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.code).toBe("RATE_LIMITED");
  });
});
