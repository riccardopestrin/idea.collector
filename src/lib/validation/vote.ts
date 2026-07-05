import type { VoteComponents } from "@/lib/proposals";

// Validazione di un voto RICE-10 utente (ADR-0006): i 4 fattori sono slider
// interi 1–10, tutti obbligatori. effort = Ease (10 = facile).
export function parseVoteFields(
  formData: FormData,
): { fields: VoteComponents } | { error: string } {
  const read = (name: string): number | null => {
    const raw = formData.get(name);
    if (raw === null || raw === "") return null;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 1 && n <= 10 ? n : null;
  };

  const fields: VoteComponents = {
    reach: read("reach"),
    impact: read("impact"),
    confidence: read("confidence"),
    effort: read("effort"),
  };

  if (Object.values(fields).some((v) => v === null)) {
    return { error: "Assegna un valore da 1 a 10 a ogni parametro." };
  }
  return { fields };
}
