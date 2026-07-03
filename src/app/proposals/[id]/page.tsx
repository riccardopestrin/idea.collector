import { notFound, redirect } from "next/navigation";

import { ProposalPanel } from "@/components/detail/ProposalPanel";
import { BackLink } from "@/components/nav/BackLink";
import { getProfile } from "@/lib/profiles";
import { getProposalDetail } from "@/lib/proposals";
import { supabaseServer } from "@/lib/supabase/server";

// Pagina piena del dettaglio: navigazione diretta / refresh / link condiviso.
// L'apertura dalla board è intercettata dal modal in @modal/(.)proposals/[id].
export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const detail = await getProposalDetail(supabase, (await params).id);
  if (!detail) notFound();

  const isAdmin = (await getProfile(supabase, user.id))?.role === "admin";

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-6">
      <BackLink />
      <ProposalPanel detail={detail} isAdmin={isAdmin} currentUserId={user.id} />
    </main>
  );
}
