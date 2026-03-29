import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { createSkillsetSchema, skillsetRowToApi } from "../types/skillset.js";
import {
  createSkillset,
  getSkillsetByName,
  updateSkillset,
  deleteSkillset,
} from "../db/skillsets.js";
import { fetchSkillsetFromGitHub } from "../github/fetch-skillset.js";
import { validateSkillset } from "../validator/skillset.js";

export const skillsetsPublishRoutes = new Hono();

// POST /skillsets — submit a new skillset to the registry
skillsetsPublishRoutes.post("/", requireAuth, async (c) => {
  const body = await c.req.json();
  const parsed = createSkillsetSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", code: "INVALID_BODY" },
      400
    );
  }

  // Check if name is taken
  const existing = await getSkillsetByName(parsed.data.name);
  if (existing) {
    return c.json(
      { error: "Skillset name already exists", code: "CONFLICT" },
      409
    );
  }

  // Fetch SKILLSET.md from source_url
  let metadata;
  try {
    metadata = await fetchSkillsetFromGitHub(parsed.data.source_url);
  } catch (err: any) {
    return c.json(
      {
        error: `Could not fetch or parse SKILLSET.md from source_url: ${err.message}`,
        code: "UNPROCESSABLE",
      },
      422
    );
  }

  // Validate and score
  const validation = validateSkillset({
    skillsetMd: metadata.skillsetMd,
    files: metadata.files,
    embeddedSkillNames: metadata.embeddedSkillNames,
    remoteSkillRefs: metadata.skillRefs.filter(
      (r) => !metadata.embeddedSkillNames.includes(r.name)
    ),
  });

  const publisher = c.get("publisher");

  // Store in database
  const skillset = await createSkillset({
    name: parsed.data.name,
    description: metadata.description,
    author: metadata.author ?? publisher.github_handle,
    source_url: parsed.data.source_url,
    trust_tier: "community",
    score: validation.score,
    spec_version: metadata.spec_version,
    tags: parsed.data.tags ?? null,
    skill_refs: metadata.skillRefs,
    published_by: publisher.id,
  });

  return c.json(
    {
      skillset: skillsetRowToApi(skillset),
      diagnostics: validation.diagnostics,
    },
    201
  );
});

// PATCH /skillsets/:name — update an existing skillset (re-fetch and re-score)
skillsetsPublishRoutes.patch("/:name", requireAuth, async (c) => {
  const name = c.req.param("name");
  const publisher = c.get("publisher");

  const existing = await getSkillsetByName(name);
  if (!existing) {
    return c.json({ error: "Skillset not found", code: "NOT_FOUND" }, 404);
  }

  if (existing.published_by !== publisher.id) {
    return c.json(
      { error: "You are not the publisher of this skillset", code: "FORBIDDEN" },
      403
    );
  }

  let metadata;
  try {
    metadata = await fetchSkillsetFromGitHub(existing.source_url);
  } catch (err: any) {
    return c.json(
      {
        error: `Could not fetch or parse SKILLSET.md: ${err.message}`,
        code: "UNPROCESSABLE",
      },
      422
    );
  }

  const validation = validateSkillset({
    skillsetMd: metadata.skillsetMd,
    files: metadata.files,
    embeddedSkillNames: metadata.embeddedSkillNames,
    remoteSkillRefs: metadata.skillRefs.filter(
      (r) => !metadata.embeddedSkillNames.includes(r.name)
    ),
  });

  const updated = await updateSkillset(name, {
    description: metadata.description,
    score: validation.score,
    spec_version: metadata.spec_version,
    skill_refs: metadata.skillRefs,
  });

  return c.json({
    skillset: skillsetRowToApi(updated!),
    diagnostics: validation.diagnostics,
  });
});

// DELETE /skillsets/:name — remove a skillset from the registry
skillsetsPublishRoutes.delete("/:name", requireAuth, async (c) => {
  const name = c.req.param("name");
  const publisher = c.get("publisher");

  const existing = await getSkillsetByName(name);
  if (!existing) {
    return c.json({ error: "Skillset not found", code: "NOT_FOUND" }, 404);
  }

  if (existing.published_by !== publisher.id) {
    return c.json(
      { error: "You are not the publisher of this skillset", code: "FORBIDDEN" },
      403
    );
  }

  await deleteSkillset(name);

  return c.json({ success: true });
});
