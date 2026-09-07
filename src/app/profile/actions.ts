"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { STRINGS } from "@/lib/strings";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

type ActionResult = { error: string } | null;

// Imposta/aggiorna profiles.name dell'utente corrente. La RLS "self update"
// (+ grant colonna name) garantisce che possa scrivere solo la propria riga.
// Niente redirect: il nome compare nell'header di ogni pagina, quindi si
// rivalida tutto il layout e chi chiama resta dov'è (l'onboarding, rileggendo il
// profilo ora completo, redirige da solo a "/").
export async function updateName(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
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

  revalidatePath("/", "layout");
  return null;
}

const SOLE_ADMIN = "unico admin: ";

// Elimina l'account corrente: la RPC delete_account (migration 0024) toglie le
// membership, cancella i progetti in cui si era soli e anonimizza il profilo in
// una transazione (rifiuta l'unico admin di un progetto con altri membri); poi
// la riga auth.users va via col service role e la sessione viene chiusa.
export async function deleteAccount(): Promise<ActionResult> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: STRINGS.errors.sessionExpired };

  const { error } = await supabase.rpc("delete_account");
  if (error) {
    if (error.message.startsWith(SOLE_ADMIN)) {
      return { error: STRINGS.profile.deleteSoleAdmin(error.message.slice(SOLE_ADMIN.length)) };
    }
    console.error("deleteAccount:", error);
    return { error: STRINGS.profile.delete.failed };
  }

  const { error: authError } = await supabaseAdmin().auth.admin.deleteUser(user.id);
  if (authError) {
    console.error("deleteAccount auth:", authError);
    return { error: STRINGS.profile.delete.failed };
  }

  await supabase.auth.signOut();
  redirect("/login");
}
