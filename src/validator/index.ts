// NOTE: This validator is duplicated in skilldex and skilldex-registry.
// Keep both in sync manually. Extract to @skilldex/validator package
// when drift becomes a real problem (i.e. you have fixed the same bug twice).

import { parse as parseYaml } from "yaml";
import type { ValidationDiagnostic } from "../types/api.js";

const MAX_LINES = 500;
const WARN_LINES = 400;
const MIN_DESCRIPTION_WORDS = 30;
const ALLOWED_SUBDIRS = new Set(["scripts", "references", "assets"]);

// File extensions that are misplaced if found in the wrong directory
const SCRIPT_EXTENSIONS = new Set([".sh", ".py", ".js", ".ts", ".rb"]);
const DOC_EXTENSIONS = new Set([".md", ".txt", ".pdf"]);

export interface ValidatorInput {
  /** The raw SKILL.md content */
  skillMd: string;
  /** List of files in the skill directory (relative paths) */
  files: string[];
}

export interface ValidationResult {
  score: number;
  diagnostics: ValidationDiagnostic[];
}

export function validateSkill(input: ValidatorInput): ValidationResult {
  const diagnostics: ValidationDiagnostic[] = [];
  let score = 100;

  const lines = input.skillMd.split("\n");

  // --- Check 1: YAML frontmatter parseable (25 points) ---
  const frontmatter = extractFrontmatter(input.skillMd);
  if (!frontmatter) {
    diagnostics.push({
      level: "error",
      line: 1,
      message: "YAML frontmatter is missing or unparseable",
    });
    // Fatal — blocks all other frontmatter-dependent checks
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
    diagnostics.push({
      level: "error",
      line: 1,
      message: "Missing required field: name",
    });
    score -= 10;
  }

  // --- Check 3: `description` field present (10 points) ---
  if (!parsed.description || typeof parsed.description !== "string" || parsed.description.trim() === "") {
    diagnostics.push({
      level: "error",
      line: 1,
      message: "Missing required field: description",
    });
    score -= 10;
  }

  // --- Check 4: description length >= 30 words (10 points) ---
  if (parsed.description && typeof parsed.description === "string") {
    const wordCount = parsed.description.trim().split(/\s+/).length;
    if (wordCount < MIN_DESCRIPTION_WORDS) {
      diagnostics.push({
        level: "error",
        line: 1,
        message: `Description is ${wordCount} words (minimum ${MIN_DESCRIPTION_WORDS})`,
      });
      score -= 10;
    }
  }

  // --- Check 5: SKILL.md under 500 lines (15 points) ---
  if (lines.length > MAX_LINES) {
    diagnostics.push({
      level: "error",
      line: MAX_LINES,
      message: `SKILL.md is ${lines.length} lines (maximum ${MAX_LINES})`,
    });
    score -= 15;
  } else if (lines.length > WARN_LINES) {
    diagnostics.push({
      level: "warning",
      line: WARN_LINES,
      message: `SKILL.md is ${lines.length} lines (warning threshold ${WARN_LINES})`,
    });
    score -= 5;
  }

  // --- Check 6: Only allowed subdirectories (10 points) ---
  const dirs = new Set<string>();
  for (const file of input.files) {
    const parts = file.split("/");
    if (parts.length > 1) {
      dirs.add(parts[0]);
    }
  }

  for (const dir of dirs) {
    if (!ALLOWED_SUBDIRS.has(dir) && !dir.startsWith(".")) {
      diagnostics.push({
        level: "warning",
        line: null,
        message: `Unknown subdirectory: ${dir}/ (allowed: ${[...ALLOWED_SUBDIRS].join(", ")})`,
      });
      score -= 3; // per unknown dir, but cap at 10
    }
  }

  // --- Check 7: All referenced resources exist (15 points) ---
  const references = extractReferences(input.skillMd);
  const fileSet = new Set(input.files);
  for (const ref of references) {
    if (!fileSet.has(ref)) {
      diagnostics.push({
        level: "error",
        line: null,
        message: `References ${ref} but file not found`,
      });
      score -= 5; // per broken ref, but cap at 15
    }
  }

  // --- Check 8: Bundled resources in correct subdirs (5 points) ---
  for (const file of input.files) {
    const parts = file.split("/");
    if (parts.length < 2) continue;
    const dir = parts[0];
    const ext = getExtension(file);

    if (dir === "references" && SCRIPT_EXTENSIONS.has(ext)) {
      diagnostics.push({
        level: "warning",
        line: null,
        message: `Script file ${file} found in references/ (should be in scripts/)`,
      });
      score -= 2;
    }

    if (dir === "scripts" && DOC_EXTENSIONS.has(ext)) {
      diagnostics.push({
        level: "warning",
        line: null,
        message: `Document file ${file} found in scripts/ (should be in references/)`,
      });
      score -= 2;
    }
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    diagnostics,
  };
}

// --- Helpers ---

function extractFrontmatter(content: string): string | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  return match ? match[1] : null;
}

function parseFrontmatter(yaml: string): Record<string, any> | null {
  try {
    return parseYaml(yaml) as Record<string, any>;
  } catch {
    return null;
  }
}

function extractReferences(content: string): string[] {
  const refs: string[] = [];
  // Match markdown-style references to local files
  const patterns = [
    /\[.*?\]\(((?:scripts|references|assets)\/[^\)]+)\)/g,
    /`((?:scripts|references|assets)\/[^`]+)`/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      refs.push(match[1]);
    }
  }
  return [...new Set(refs)];
}

function getExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf(".");
  return dotIndex >= 0 ? filename.slice(dotIndex) : "";
}
