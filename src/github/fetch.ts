import { parse as parseYaml } from "yaml";

export interface SkillMetadata {
  name: string;
  description: string;
  spec_version: string;
  author?: string;
  skillMd: string;
  files: string[];
}

/**
 * Fetch SKILL.md and file list from a GitHub repository URL.
 * Expects a URL like: https://github.com/user/repo or https://github.com/user/repo/tree/branch/subpath
 */
export async function fetchSkillFromGitHub(sourceUrl: string): Promise<SkillMetadata> {
  const { owner, repo, branch, subpath } = parseGitHubUrl(sourceUrl);
  const token = process.env.GITHUB_TOKEN;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "skilldex-registry",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const ref = branch || "main";
  const basePath = subpath ? `${subpath}/` : "";

  // Fetch SKILL.md content
  const skillMdPath = `${basePath}SKILL.md`;
  const skillMdContent = await fetchFileContent(owner, repo, ref, skillMdPath, headers);

  if (!skillMdContent) {
    throw Object.assign(
      new Error(`Could not fetch SKILL.md from ${sourceUrl}`),
      { code: "FETCH_FAILED" }
    );
  }

  // Fetch file listing from the directory
  const files = await fetchDirectoryListing(owner, repo, ref, basePath, headers);

  // Parse frontmatter
  const frontmatter = extractFrontmatter(skillMdContent);
  if (!frontmatter) {
    throw Object.assign(
      new Error("SKILL.md is missing YAML frontmatter"),
      { code: "PARSE_FAILED" }
    );
  }

  const parsed = parseYaml(frontmatter) as Record<string, any>;

  return {
    name: parsed.name ?? "",
    description: parsed.description ?? "",
    spec_version: parsed.spec_version ?? "1.0",
    author: parsed.author,
    skillMd: skillMdContent,
    files,
  };
}

// --- Internal helpers ---

function parseGitHubUrl(url: string): {
  owner: string;
  repo: string;
  branch?: string;
  subpath?: string;
} {
  // Remove trailing slashes and .git
  const cleaned = url.replace(/\.git$/, "").replace(/\/$/, "");
  const urlObj = new URL(cleaned);
  const parts = urlObj.pathname.split("/").filter(Boolean);

  if (parts.length < 2) {
    throw new Error(`Invalid GitHub URL: ${url}`);
  }

  const owner = parts[0];
  const repo = parts[1];

  // https://github.com/owner/repo/tree/branch/subpath
  if (parts[2] === "tree" && parts.length >= 4) {
    return {
      owner,
      repo,
      branch: parts[3],
      subpath: parts.length > 4 ? parts.slice(4).join("/") : undefined,
    };
  }

  return { owner, repo };
}

async function fetchFileContent(
  owner: string,
  repo: string,
  ref: string,
  path: string,
  headers: Record<string, string>
): Promise<string | null> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${ref}`;
  const response = await fetch(url, { headers });

  if (!response.ok) return null;

  const data = (await response.json()) as { content?: string; encoding?: string };

  if (data.content && data.encoding === "base64") {
    return Buffer.from(data.content, "base64").toString("utf-8");
  }

  return null;
}

async function fetchDirectoryListing(
  owner: string,
  repo: string,
  ref: string,
  basePath: string,
  headers: Record<string, string>
): Promise<string[]> {
  // Use the Git Trees API for recursive listing
  const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`;
  const response = await fetch(treeUrl, { headers });

  if (!response.ok) return [];

  const data = (await response.json()) as {
    tree: Array<{ path: string; type: string }>;
  };

  const prefix = basePath.replace(/\/$/, "");
  return data.tree
    .filter((entry) => entry.type === "blob")
    .map((entry) => entry.path)
    .filter((path) => {
      if (!prefix) return true;
      return path.startsWith(prefix + "/");
    })
    .map((path) => {
      if (!prefix) return path;
      return path.slice(prefix.length + 1);
    })
    .filter((path) => path !== "SKILL.md"); // exclude SKILL.md itself from file list
}

function extractFrontmatter(content: string): string | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  return match ? match[1] : null;
}
