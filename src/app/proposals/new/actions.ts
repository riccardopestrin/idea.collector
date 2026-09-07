"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { STRINGS } from "@/lib/strings";
import { supabaseServer } from "@/lib/supabase/server";
import { parseProposalFields } from "@/lib/validation/proposal";

type CreateProposalState = { error: string } | null;

// Crea una proposta a nome dell'utente corrente nel progetto dato. Autorizza
// (deve essere loggato e membro: la RLS impone proposer_id = auth.uid() e la
// membership) e orchestra l'insert. projectId arriva via bind dal form.
export async function createProposal(
  projectId: string,
  _prev: CreateProposalState,
  formData: FormData
): Promise<CreateProposalState> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: STRINGS.errors.sessionExpired };

  const parsed = parseProposalFields(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { data, error } = await supabase
    .from("proposals")
    .insert({ ...parsed.fields, proposer_id: user.id, project_id: projectId })
    .select("id")
    .single();
  if (error || !data) {
    console.error("createProposal:", error);
    return { error: STRINGS.errors.saveFailed };
  }

  revalidatePath(`/projects/${projectId}`); // altrimenti la board mostra la cache senza la nuova proposta
  // RFC-006: si atterra sul dettaglio, dove ProposalScanTrigger avvia lo scan.
  redirect(`/proposals/${data.id}`);
}
