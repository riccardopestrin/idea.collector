import type { VoteComponents } from "@/lib/proposals";

// Validazione di un voto RICE utente: ogni componente è uno slider 1–10 (intero).
// reach non si vota nel metodo ICE (solo impact/confidence/ease).
export function parseVoteFields(
  formData: FormData,
  method: "rice" | "ice",
): { fields: VoteComponents } | { error: string } {
  const read = (name: string): number | null => {
    const raw = formData.get(name);
    if (raw === null || raw === "") return null;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 1 && n <= 10 ? n : null;
  };

  const fields: VoteComponents = {
    reach: method === "ice" ? null : read("reach"),
    impact: read("impact"),
    confidence: read("confidence"),
    effort: read("effort"),
  };

  const required =
    method === "ice"
      ? (["impact", "confidence", "effort"] as const)
      : (["reach", "impact", "confidence", "effort"] as const);
  if (required.some((f) => fields[f] === null)) {
    return { error: "Assegna un valore da 1 a 10 a ogni parametro." };
  }
  return { fields };
}
