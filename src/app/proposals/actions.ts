"use server";

import { refresh } from "next/cache";

import { isProposalStatus } from "@/lib/proposals";
import { supabaseServer } from "@/lib/supabase/server";

type UpdateStatusResult = { error: string } | null;

// Sposta una proposta in un nuovo stato e logga la transizione in status_history.
// Solo admin: è l'invariante del DB (trigger proposals_lock_privileged_columns
// + policy "admin insert history" in 0003/0001); il guard qui è il livello
// applicativo, il DB resta il backstop.
export async function updateProposalStatus(
  proposalId: string,
  toStatus: string,
): Promise<UpdateStatusResult> {
  if (!isProposalStatus(toStatus)) return { error: "Stato non valido." };

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessione scaduta. Rientra e riprova." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return { error: "Solo un admin può spostare le proposte." };
  }

  const { data: proposal } = await supabase
    .from("proposals")
    .select("status")
    .eq("id", proposalId)
    .single();
  if (!proposal) return { error: "Proposta non trovata." };
  if (proposal.status === toStatus) return null;

  const { error } = await supabase
    .from("proposals")
    .update({ status: toStatus })
    .eq("id", proposalId);
  if (error) {
    console.error("updateProposalStatus:", error);
    return { error: "Errore nel salvataggio. Riprova." };
  }

  // ponytail: update + history non atomici (servirebbe una RPC, migration
  // owner-locked); se la history fallisce lo stato è comunque cambiato — log.
  const { error: historyError } = await supabase.from("status_history").insert({
    proposal_id: proposalId,
    from_status: proposal.status,
    to_status: toStatus,
    author_id: user.id,
  });
  if (historyError) console.error("updateProposalStatus history:", historyError);

  refresh();
  return null;
}
