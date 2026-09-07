import { notFound } from "next/navigation";

import { DetailModal } from "@/components/detail/DetailModal";
import { ProposalPanel } from "@/components/detail/ProposalPanel";
import { connectedRepo } from "@/lib/github/settings";
import { isProjectAdmin } from "@/lib/projects";
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
  const isAdmin = user ? await isProjectAdmin(supabase, detail.project_id, user.id) : false;

  return (
    <DetailModal size="xl" fill>
      <ProposalPanel
        detail={detail}
        isAdmin={isAdmin}
        currentUserId={user?.id}
        repo={connectedRepo(detail.project)}
        fill
      />
    </DetailModal>
  );
}
