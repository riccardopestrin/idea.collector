"use server";

import { redirect } from "next/navigation";

import { supabaseServer } from "@/lib/supabase/server";

type UpdateNameState = { error: string } | null;

// Imposta/aggiorna profiles.name dell'utente corrente. La RLS "self update"
// (+ grant colonna name) garantisce che possa scrivere solo la propria riga.
export async function updateName(
  _prev: UpdateNameState,
  formData: FormData
): Promise<UpdateNameState> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessione scaduta. Rientra e riprova." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Il nome è obbligatorio." };
  // Nessun CHECK a DB (owner-locked): il cap applicativo è l'unico limite.
  if (name.length > 80)
    return { error: "Il nome è troppo lungo (max 80 caratteri)." };

  const { error } = await supabase
    .from("profiles")
    .update({ name })
    .eq("id", user.id);
  if (error) return { error: "Errore nel salvataggio. Riprova." };

  redirect("/");
}
