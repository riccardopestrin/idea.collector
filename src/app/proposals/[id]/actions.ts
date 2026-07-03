"use server";

import { refresh } from "next/cache";

import { runEvaluation } from "@/lib/ai/runEvaluation";
import { getProfile } from "@/lib/profiles";
import { supabaseServer } from "@/lib/supabase/server";
import { parseProposalFields } from "@/lib/validation/proposal";

type UpdateProposalState = { error: string } | null;

// Edit di una proposta (RFC-004 Fase E). Autorizzazione nel service: proposer
// o admin, solo in 'nuova'/'in_valutazione' (trigger di cristallizzazione 0013
// e enforce_proposal_privileged_columns come backstop). In 'in_valutazione' un
// cambio dei campi testuali rilancia la valutazione AI; il fallimento eval non
// fa fallire il save (semantica non bloccante esistente).
export async function updateProposal(
  proposalId: string,
  _prev: UpdateProposalState,
  formData: FormData,
): Promise<UpdateProposalState> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessione scaduta. Rientra e riprova." };

  const parsed = parseProposalFields(formData);
  if ("error" in parsed) return { error: parsed.error };
  const { fields } = parsed;

  const { data: proposal } = await supabase
    .from("proposals")
    .select("proposer_id, status, title, description, problem")
    .eq("id", proposalId)
    .maybeSingle();
  if (!proposal) return { error: "Proposta non trovata." };

  if (
    proposal.proposer_id !== user.id &&
    (await getProfile(supabase, user.id))?.role !== "admin"
  ) {
    return { error: "Solo l'autore o un admin può modificare la proposta." };
  }
  if (proposal.status !== "nuova" && proposal.status !== "in_valutazione") {
    return { error: "La proposta non è più modificabile." };
  }

  const { error } = await supabase
    .from("proposals")
    .update(fields)
    .eq("id", proposalId);
  if (error) {
    console.error("updateProposal:", error);
    return { error: "Errore nel salvataggio. Riprova." };
  }

  refresh();

  // Re-eval solo se il testo è cambiato davvero: evita chiamate Claude inutili.
  const textChanged =
    fields.title !== proposal.title ||
    fields.description !== proposal.description ||
    fields.problem !== proposal.problem;
  if (proposal.status === "in_valutazione" && textChanged) {
    await runEvaluation(supabase, proposalId, true);
  }

  return null;
}
