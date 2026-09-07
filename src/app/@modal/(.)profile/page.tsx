import { redirect } from "next/navigation";

import { DetailModal } from "@/components/detail/DetailModal";
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
    <DetailModal narrow>
      <div className="p-8">
        <NameForm
          heading={STRINGS.profile.heading}
          defaultName={profile?.name ?? undefined}
          backOnSave
        />
      </div>
    </DetailModal>
  );
}
