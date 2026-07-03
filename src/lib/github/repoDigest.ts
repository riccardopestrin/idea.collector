import { installationToken } from "@/lib/github/app";

// Digest compatto e deterministico del repo (RFC-003): poche chiamate REST,
// output stabile tra proposte diverse → prefisso cacheabile lato Claude.

const GITHUB_API = "https://api.github.com";
const README_MAX_CHARS = 8_000;
const TREE_MAX_PATHS = 400;
const COMMITS_COUNT = 20;
const CACHE_TTL_MS = 10 * 60_000; // cache server-side per non ricolpire GitHub a ogni valutazione

const cache = new Map<string, { digest: string; expiresAt: number }>();

async function gh(token: string, path: string): Promise<Response> {
  return fetch(`${GITHUB_API}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${token}`,
    },
  });
}

async function ghJson<T>(token: string, path: string): Promise<T | null> {
  const res = await gh(token, path);
  if (!res.ok) return null;
  return (await res.json()) as T;
}

export async function buildRepoDigest(
  installationId: number,
  owner: string,
  repo: string,
): Promise<string> {
  const key = `${owner}/${repo}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.digest;

  const token = await installationToken(installationId);
  const base = `/repos/${owner}/${repo}`;

  const meta = await ghJson<{
    description: string | null;
    topics: string[];
    language: string | null;
    default_branch: string;
    open_issues_count: number;
  }>(token, base);
  if (!meta) throw new Error(`GitHub: repo ${key} non raggiungibile`);

  const [languages, readme, tree, commits, packageJson] = await Promise.all([
    ghJson<Record<string, number>>(token, `${base}/languages`),
    ghJson<{ content: string }>(token, `${base}/readme`),
    ghJson<{ tree: { path: string; type: string }[]; truncated: boolean }>(
      token,
      `${base}/git/trees/${meta.default_branch}?recursive=1`,
    ),
    ghJson<{ commit: { message: string; author: { date: string } | null } }[]>(
      token,
      `${base}/commits?per_page=${COMMITS_COUNT}`,
    ),
    ghJson<{ content: string }>(token, `${base}/contents/package.json`),
  ]);

  const decode = (b64: string) => Buffer.from(b64, "base64").toString("utf-8");
  const paths = (tree?.tree ?? [])
    .filter((e) => e.type === "blob")
    .map((e) => e.path)
    .slice(0, TREE_MAX_PATHS);

  const sections = [
    `# Repository: ${key}`,
    meta.description ? `Descrizione: ${meta.description}` : null,
    meta.topics.length ? `Topics: ${meta.topics.join(", ")}` : null,
    `Linguaggio principale: ${meta.language ?? "n/d"} · Issue aperte: ${meta.open_issues_count}`,
    languages ? `Linguaggi: ${Object.keys(languages).join(", ")}` : null,
    readme
      ? `## README (troncato)\n${decode(readme.content).slice(0, README_MAX_CHARS)}`
      : null,
    packageJson ? `## package.json\n${decode(packageJson.content)}` : null,
    paths.length ? `## Struttura file (primi ${paths.length})\n${paths.join("\n")}` : null,
    commits?.length
      ? `## Ultimi commit\n${commits
          .map((c) => `- ${c.commit.message.split("\n")[0]}`)
          .join("\n")}`
      : null,
  ];

  const digest = sections.filter(Boolean).join("\n\n");
  cache.set(key, { digest, expiresAt: Date.now() + CACHE_TTL_MS });
  return digest;
}
