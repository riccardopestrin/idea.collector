import { redirect } from "next/navigation";

import { NameForm } from "@/components/form/NameForm";
import { BackLink } from "@/components/nav/BackLink";
import { getProfile } from "@/lib/profiles";
import { STRINGS } from "@/lib/strings";
import { supabaseServer } from "@/lib/supabase/server";

// Pagina profilo: solo il nome. Membri e repo GitHub sono per progetto e
// vivono in /projects/[id]/settings (RFC-007).
export default async function ProfilePage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase, user.id);

  return (
    <main className="flex flex-1 flex-col items-center gap-8 p-6">
      <div className="w-full max-w-lg">
        <BackLink href="/" label={STRINGS.nav.backToProjects} />
      </div>
      <NameForm heading={STRINGS.profile.heading} defaultName={profile?.name ?? undefined} />
    </main>
  );
}
