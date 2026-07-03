import { notFound, redirect } from "next/navigation";

import { ProposalPanel } from "@/components/detail/ProposalPanel";
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
    <main className="mx-auto w-full max-w-2xl flex-1">
      <ProposalPanel detail={detail} isAdmin={isAdmin} />
    </main>
  );
}
