import { redirect } from "next/navigation";

import { NameForm } from "@/components/form/NameForm";
import { getProfile } from "@/lib/profiles";
import { supabaseServer } from "@/lib/supabase/server";

// Pagina profilo: modifica (o inserimento tardivo) del nome.
export default async function ProfilePage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase, user.id);

  return <NameForm heading="Profilo" defaultName={profile?.name ?? undefined} />;
}
