import { DetailModal } from "@/components/detail/DetailModal";
import { NewProposalForm } from "@/components/proposals/NewProposalForm";

// Intercetta /projects/[projectId]/proposals/new durante la navigazione client
// dalla board: stesso form della pagina piena, in overlay.
export default async function NewProposalModal({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  return (
    <DetailModal>
      <div className="p-6">
        <NewProposalForm projectId={(await params).projectId} />
      </div>
    </DetailModal>
  );
}
