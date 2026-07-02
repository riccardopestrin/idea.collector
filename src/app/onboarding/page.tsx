import { redirect } from "next/navigation";

import { NameForm } from "@/components/form/NameForm";
import { getProfile } from "@/lib/profiles";
import { supabaseServer } from "@/lib/supabase/server";

// Pagina post-login per completare il profilo: esiste solo finché name è NULL.
export default async function OnboardingPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase, user.id);
  if (profile?.name) redirect("/");

  return <NameForm heading="Come ti chiami?" />;
}
