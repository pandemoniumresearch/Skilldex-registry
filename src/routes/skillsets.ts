import { Hono } from "hono";
import { searchSkillsetsSchema, skillsetRowToApi } from "../types/skillset.js";
import { searchSkillsets, getSkillsetByName } from "../db/skillsets.js";

export const skillsetsRoutes = new Hono();

// GET /skillsets — list and search skillsets
skillsetsRoutes.get("/", async (c) => {
  const raw = Object.fromEntries(new URL(c.req.url).searchParams);
  const parsed = searchSkillsetsSchema.safeParse(raw);

  if (!parsed.success) {
    return c.json(
      { error: "Invalid query parameters", code: "INVALID_PARAMS" },
      400
    );
  }

  const { skillsets, total } = await searchSkillsets(parsed.data);

  return c.json({
    skillsets: skillsets.map(skillsetRowToApi),
    total,
    limit: parsed.data.limit,
    offset: parsed.data.offset,
  });
});

// GET /skillsets/:name — get a single skillset by name
skillsetsRoutes.get("/:name", async (c) => {
  const name = c.req.param("name");
  const skillset = await getSkillsetByName(name);

  if (!skillset) {
    return c.json({ error: "Skillset not found", code: "NOT_FOUND" }, 404);
  }

  return c.json(skillsetRowToApi(skillset));
});
