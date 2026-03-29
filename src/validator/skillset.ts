import { parse as parseYaml } from "yaml";
import type { ValidationDiagnostic } from "../types/api.js";

const MIN_DESCRIPTION_WORDS = 30;

export interface SkillsetValidatorInput {
  skillsetMd: string;
  files: string[];
  embeddedSkillNames: string[];
  remoteSkillRefs: Array<{ name: string; source_url: string }>;
}

export interface SkillsetValidationResult {
  score: number;
  diagnostics: ValidationDiagnostic[];
}

export function validateSkillset(input: SkillsetValidatorInput): SkillsetValidationResult {
  const diagnostics: ValidationDiagnostic[] = [];
  let score = 100;

  // --- Check 1: YAML frontmatter parseable (25 points) ---
  const frontmatter = extractFrontmatter(input.skillsetMd);
  if (!frontmatter) {
    diagnostics.push({
      level: "error",
      line: 1,
      message: "YAML frontmatter is missing or unparseable",
    });
    return { score: 0, diagnostics };
  }

  const parsed = parseFrontmatter(frontmatter);
  if (!parsed) {
    diagnostics.push({
      level: "error",
      line: 1,
      message: "YAML frontmatter could not be parsed",
    });
    return { score: 0, diagnostics };
  }

  // --- Check 2: `name` field present (10 points) ---
  if (!parsed.name || typeof parsed.name !== "string" || parsed.name.trim() === "") {
    score -= 10;
    diagnostics.push({
      level: "error",
      line: null,
      message: 'Required field "name" is missing or empty',
    });
  }

  // --- Check 3: `description` field present (10 points) ---
  if (!parsed.description || typeof parsed.description !== "string" || parsed.description.trim() === "") {
    score -= 10;
    diagnostics.push({
      level: "error",
      line: null,
      message: 'Required field "description" is missing or empty',
    });
  } else {
    // --- Check 4: description length >= 30 words (10 points) ---
    const wordCount = parsed.description.trim().split(/\s+/).length;
    if (wordCount < MIN_DESCRIPTION_WORDS) {
      score -= 10;
      diagnostics.push({
        level: "error",
        line: null,
        message: `description too short (${wordCount} words, recommended ${MIN_DESCRIPTION_WORDS}+)`,
      });
    }
  }

  // --- Check 5: at least 1 skill (20 points) ---
  const totalSkills = input.embeddedSkillNames.length + input.remoteSkillRefs.length;
  if (totalSkills === 0) {
    score -= 20;
    diagnostics.push({
      level: "error",
      line: null,
      message: "Skillset must contain at least one embedded skill or remote skill reference",
    });
  }

  // --- Check 6: no unknown top-level dirs (10 points) ---
  const embeddedSet = new Set(input.embeddedSkillNames);
  const unknownDirs = getUnknownDirs(input.files, embeddedSet);
  if (unknownDirs.length > 0) {
    const deduction = Math.min(10, unknownDirs.length * 3);
    score -= deduction;
    for (const dir of unknownDirs) {
      diagnostics.push({
        level: "warning",
        line: null,
        message: `Unknown subdirectory "${dir}" — only embedded skill dirs (with SKILL.md) and assets/ are allowed`,
      });
    }
  }

  // --- Check 7: remote source_url fields are valid GitHub URLs (15 points) ---
  if (input.remoteSkillRefs.length > 0) {
    const invalidRefs = input.remoteSkillRefs.filter((s) => !isValidGitHubUrl(s.source_url));
    if (invalidRefs.length > 0) {
      score -= 15;
      for (const ref of invalidRefs) {
        diagnostics.push({
          level: "error",
          line: null,
          message: `Remote skill "${ref.name}" has invalid source_url: "${ref.source_url}" — must be a GitHub URL`,
        });
      }
    }
  }

  score = Math.min(100, Math.max(0, Math.round(score)));

  return { score, diagnostics };
}

// --- Helpers ---

function extractFrontmatter(content: string): string | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  return match ? match[1] : null;
}

function parseFrontmatter(frontmatter: string): Record<string, any> | null {
  try {
    const result = parseYaml(frontmatter);
    if (typeof result !== "object" || result === null) return null;
    return result as Record<string, any>;
  } catch {
    return null;
  }
}

function getUnknownDirs(files: string[], embeddedSet: Set<string>): string[] {
  const topLevelDirs = new Set<string>();
  for (const file of files) {
    const parts = file.split("/");
    if (parts.length >= 2) {
      topLevelDirs.add(parts[0]);
    }
  }

  const unknown: string[] = [];
  for (const dir of topLevelDirs) {
    if (dir === "assets") continue;
    if (embeddedSet.has(dir)) continue;
    unknown.push(dir);
  }
  return unknown;
}

function isValidGitHubUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "github.com" && parsed.protocol === "https:";
  } catch {
    return false;
  }
}
