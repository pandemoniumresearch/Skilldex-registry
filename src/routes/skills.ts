import { Hono } from "hono";
import { searchSkillsSchema, skillRowToApi } from "../types/skill.js";
import { searchSkills, getSkillByName } from "../db/skills.js";

export const skillsRoutes = new Hono();

// GET /skills — list and search skills
skillsRoutes.get("/", async (c) => {
  const raw = Object.fromEntries(new URL(c.req.url).searchParams);
  const parsed = searchSkillsSchema.safeParse(raw);

  if (!parsed.success) {
    return c.json(
      { error: "Invalid query parameters", code: "INVALID_PARAMS" },
      400
    );
  }

  const { skills, total } = await searchSkills(parsed.data);

  return c.json({
    skills: skills.map(skillRowToApi),
    total,
    limit: parsed.data.limit,
    offset: parsed.data.offset,
  });
});

// GET /skills/:name — get a single skill by name
skillsRoutes.get("/:name", async (c) => {
  const name = c.req.param("name");
  const skill = await getSkillByName(name);

  if (!skill) {
    return c.json({ error: "Skill not found", code: "NOT_FOUND" }, 404);
  }

  return c.json(skillRowToApi(skill));
});
