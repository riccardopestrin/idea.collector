import { redirect } from "next/navigation";

import { DeleteSection } from "@/components/form/DeleteSection";
import { EmailForm } from "@/components/form/EmailForm";
import { NameForm } from "@/components/form/NameForm";
import { AppHeader } from "@/components/nav/AppHeader";
import { getProfile } from "@/lib/profiles";
import { STRINGS } from "@/lib/strings";
import { currentUser, supabaseServer } from "@/lib/supabase/server";

import { deleteAccount } from "./actions";

// Pagina profilo piena: navigazione diretta / refresh. Dall'app il profilo si
// apre nell'overlay @modal/(.)profile. Nome ed eliminazione account: membri e
// repo GitHub sono per progetto e vivono in /projects/[id]/settings (RFC-007).
export default async function ProfilePage() {
  const supabase = await supabaseServer();
  const user = await currentUser(supabase);
  if (!user) redirect("/login");

  const profile = await getProfile(supabase, user.id);

  return (
    <>
      <AppHeader profileLabel={profile?.name ?? profile?.email} />
      <main className="flex flex-1 flex-col items-center gap-8 p-6">
        <NameForm heading={STRINGS.profile.heading} defaultName={profile?.name ?? undefined} />
        <EmailForm currentEmail={profile?.email ?? ""} />
        <DeleteSection
          texts={STRINGS.profile.delete}
          confirmHeading={STRINGS.profile.delete.confirmHeading}
          action={deleteAccount}
        />
      </main>
    </>
  );
}
