import { Hono } from "hono";
import { incrementInstallCount } from "../db/skills.js";
import type { InstallResponse } from "../types/api.js";

export const installRoutes = new Hono();

// GET /skills/:name/install — increment install count and return source URL
installRoutes.get("/:name/install", async (c) => {
  const name = c.req.param("name");
  const skill = await incrementInstallCount(name);

  if (!skill) {
    return c.json({ error: "Skill not found", code: "NOT_FOUND" }, 404);
  }

  const response: InstallResponse = {
    name: skill.name,
    source_url: skill.source_url,
    score: skill.score,
    spec_version: skill.spec_version,
    trust_tier: skill.trust_tier as "verified" | "community",
  };

  return c.json(response);
});
