import { Hono } from "hono";
import { incrementSkillsetInstallCount } from "../db/skillsets.js";

export const skillsetsInstallRoutes = new Hono();

// GET /skillsets/:name/install — increment install count and return install info
skillsetsInstallRoutes.get("/:name/install", async (c) => {
  const name = c.req.param("name");
  const skillset = await incrementSkillsetInstallCount(name);

  if (!skillset) {
    return c.json({ error: "Skillset not found", code: "NOT_FOUND" }, 404);
  }

  return c.json({
    name: skillset.name,
    source_url: skillset.source_url,
    score: skillset.score,
    spec_version: skillset.spec_version,
    trust_tier: skillset.trust_tier,
    skills: skillset.skill_refs ?? [],
  });
});
