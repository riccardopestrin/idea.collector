import { notFound } from "next/navigation";

import { DetailModal } from "@/components/detail/DetailModal";
import { ProposalPanel } from "@/components/detail/ProposalPanel";
import { getProfile } from "@/lib/profiles";
import { getProposalDetail } from "@/lib/proposals";
import { supabaseServer } from "@/lib/supabase/server";

// Intercetta /proposals/[id] durante la navigazione client dalla board: stesso
// contenuto della pagina piena, in overlay. Il proxy garantisce già l'auth.
export default async function ProposalDetailModal({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await supabaseServer();
  const detail = await getProposalDetail(supabase, (await params).id);
  if (!detail) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAdmin = user
    ? (await getProfile(supabase, user.id))?.role === "admin"
    : false;

  return (
    <DetailModal>
      <ProposalPanel detail={detail} isAdmin={isAdmin} />
    </DetailModal>
  );
}
