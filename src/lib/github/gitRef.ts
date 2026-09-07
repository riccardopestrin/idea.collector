// git_ref di una proposta (migration 0020): "#123" = pull request, altrimenti
// nome di branch. Il link punta alla repo collegata al progetto (projects, 0021).
export function gitRefUrl(ref: string, repo: { owner: string; name: string }): string {
  const base = `https://github.com/${repo.owner}/${repo.name}`;
  const pr = /^#(\d+)$/.exec(ref);
  if (pr) return `${base}/pull/${pr[1]}`;
  // i branch possono contenere "/" (feature/x): si codifica segmento per segmento
  return `${base}/tree/${ref.split("/").map(encodeURIComponent).join("/")}`;
}

// Normalizza l'input utente: vuoto → null (cancella), "123" → "#123", niente
// spazi, cap 200 (check a DB). Ritorna undefined se invalido.
export function parseGitRef(raw: string): string | null | undefined {
  const value = raw.trim();
  if (!value) return null;
  if (/\s/.test(value) || value.length > 200) return undefined;
  // git vieta segmenti vuoti, "." e ".."; qui evitano anche che il link esca dal path della repo
  if (value.split("/").some((s) => s === "" || s === "." || s === "..")) return undefined;
  return /^\d+$/.test(value) ? `#${value}` : value;
}
