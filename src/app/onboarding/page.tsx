import { redirect } from "next/navigation";

import { NameForm } from "@/components/form/NameForm";
import { Wordmark } from "@/components/nav/Wordmark";
import { getProfile } from "@/lib/profiles";
import { STRINGS } from "@/lib/strings";
import { currentUser, supabaseServer } from "@/lib/supabase/server";

// Pagina post-login per completare il profilo: esiste solo finché name è NULL.
export default async function OnboardingPage() {
  const supabase = await supabaseServer();
  const user = await currentUser(supabase);
  if (!user) redirect("/login");

  const profile = await getProfile(supabase, user.id);
  if (profile?.name) redirect("/");

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="flex w-full max-w-lg flex-col gap-8 border border-ink bg-paper p-8 shadow-hard-lg">
        <Wordmark className="text-2xl" />
        <NameForm heading={STRINGS.profile.onboardingHeading} />
      </div>
    </main>
  );
}
