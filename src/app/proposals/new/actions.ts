"use server";

import { redirect } from "next/navigation";

import { supabaseServer } from "@/lib/supabase/server";

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

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Il titolo è obbligatorio." };

  const optional = (name: string) => {
    const value = String(formData.get(name) ?? "").trim();
    return value === "" ? null : value;
  };
  const links = String(formData.get("links") ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const { error } = await supabase.from("proposals").insert({
    title,
    description: optional("description"),
    problem: optional("problem"),
    links,
    proposer_id: user.id,
  });
  if (error) return { error: "Errore nel salvataggio. Riprova." };

  redirect("/");
}
