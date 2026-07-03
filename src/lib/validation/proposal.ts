// Validazione condivisa create/update proposta (RFC-004 Fase E).
// I campi rich-text sono markdown (ADR-0005): cap difensivo a 20k caratteri.

export const TEXT_FIELD_MAX = 20_000;

export type ProposalFields = {
  title: string;
  description: string | null;
  problem: string | null;
  links: string[];
};

export function parseProposalFields(
  formData: FormData,
): { fields: ProposalFields } | { error: string } {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Il titolo è obbligatorio." };

  const optional = (name: string) => {
    const value = String(formData.get(name) ?? "").trim();
    return value === "" ? null : value;
  };
  const description = optional("description");
  const problem = optional("problem");
  if ((description?.length ?? 0) > TEXT_FIELD_MAX || (problem?.length ?? 0) > TEXT_FIELD_MAX) {
    return { error: "Testo troppo lungo (max 20.000 caratteri per campo)." };
  }

  const links = String(formData.get("links") ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return { fields: { title, description, problem, links } };
}
