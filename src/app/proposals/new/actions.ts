"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { supabaseServer } from "@/lib/supabase/server";
import { parseProposalFields } from "@/lib/validation/proposal";

type CreateProposalState = { error: string } | null;

// Crea una proposta a nome dell'utente corrente. Autorizza (deve essere loggato)
// e orchestra l'insert; la RLS impone comunque proposer_id = auth.uid().
export async function createProposal(
  _prev: CreateProposalState,
  formData: FormData
): Promise<CreateProposalState> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessione scaduta. Rientra e riprova." };

  const parsed = parseProposalFields(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { error } = await supabase
    .from("proposals")
    .insert({ ...parsed.fields, proposer_id: user.id });
  if (error) return { error: "Errore nel salvataggio. Riprova." };

  revalidatePath("/"); // altrimenti la board mostra la cache senza la nuova proposta
  redirect("/");
}
