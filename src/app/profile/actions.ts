"use server";

import { redirect } from "next/navigation";

import { STRINGS } from "@/lib/strings";
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
  if (!user) return { error: STRINGS.errors.sessionExpired };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: STRINGS.profile.nameRequired };
  // Backstop a DB: profiles_name_length_check (0008), stesso cap di 80.
  if (name.length > 80) return { error: STRINGS.profile.nameTooLong };

  const { error } = await supabase
    .from("profiles")
    .update({ name })
    .eq("id", user.id);
  if (error) return { error: STRINGS.errors.saveFailed };

  redirect("/");
}
