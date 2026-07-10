import { redirect } from "next/navigation";

import { NameForm } from "@/components/form/NameForm";
import { getProfile } from "@/lib/profiles";
import { STRINGS } from "@/lib/strings";
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

  return (
    <main className="flex flex-1 justify-center p-6">
      <NameForm heading={STRINGS.profile.onboardingHeading} />
    </main>
  );
}
