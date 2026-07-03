import { createSign } from "node:crypto";

// Integrazione GitHub App (ADR-0004): JWT firmato con la private key → token
// di accesso all'installazione (~1h), read-only sulla repo autorizzata.
// Nessun token longevo: il token vive solo nella cache in-memory del server.

const GITHUB_API = "https://api.github.com";

const HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

// JWT RS256 dell'App (iss = app id, validità 9 min). Solo stdlib, niente dipendenze.
function appJwt(): string {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!appId || !privateKey) {
    throw new Error("GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY non configurate");
  }
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  // iat nel passato per tollerare clock drift, come da docs GitHub
  const payload = base64url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId }));
  const signature = createSign("RSA-SHA256")
    .update(`${header}.${payload}`)
    .sign(privateKey, "base64url");
  return `${header}.${payload}.${signature}`;
}

// Cache in-memory del token di installazione (scade ~1h; margine 60s).
let cachedToken: { installationId: number; token: string; expiresAt: number } | null = null;

export async function installationToken(installationId: number): Promise<string> {
  if (
    cachedToken &&
    cachedToken.installationId === installationId &&
    cachedToken.expiresAt > Date.now() + 60_000
  ) {
    return cachedToken.token;
  }
  const res = await fetch(`${GITHUB_API}/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    headers: { ...HEADERS, Authorization: `Bearer ${appJwt()}` },
  });
  if (!res.ok) {
    throw new Error(`GitHub: token installazione fallito (${res.status})`);
  }
  const data = (await res.json()) as { token: string; expires_at: string };
  cachedToken = {
    installationId,
    token: data.token,
    expiresAt: new Date(data.expires_at).getTime(),
  };
  return data.token;
}

export type InstallationRepo = { owner: string; name: string };

// Repo coperte dall'autorizzazione (per il picker nel profilo).
export async function listInstallationRepos(
  installationId: number,
): Promise<InstallationRepo[]> {
  const token = await installationToken(installationId);
  const res = await fetch(`${GITHUB_API}/installation/repositories?per_page=100`, {
    headers: { ...HEADERS, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GitHub: lista repo fallita (${res.status})`);
  const data = (await res.json()) as {
    repositories: { name: string; owner: { login: string } }[];
  };
  return data.repositories.map((r) => ({ owner: r.owner.login, name: r.name }));
}
