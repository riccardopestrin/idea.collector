import { redirect } from "next/navigation";

import { deleteAccount } from "@/app/profile/actions";
import { DetailModal } from "@/components/detail/DetailModal";
import { DeleteSection } from "@/components/form/DeleteSection";
import { EmailForm } from "@/components/form/EmailForm";
import { NameForm } from "@/components/form/NameForm";
import { getProfile } from "@/lib/profiles";
import { STRINGS } from "@/lib/strings";
import { supabaseServer } from "@/lib/supabase/server";

// Intercetta /profile durante la navigazione client (link nell'header): il
// profilo si apre in overlay sopra la pagina corrente e chiudendolo si torna lì.
export default async function ProfileModal() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase, user.id);

  return (
    <DetailModal size="sm">
      <div className="flex flex-col gap-8 p-8">
        <NameForm
          heading={STRINGS.profile.heading}
          defaultName={profile?.name ?? undefined}
          backOnSave
        />
        <EmailForm currentEmail={user.email ?? ""} />
        <DeleteSection
          texts={STRINGS.profile.delete}
          confirmHeading={STRINGS.profile.delete.confirmHeading}
          action={deleteAccount}
        />
      </div>
    </DetailModal>
  );
}
