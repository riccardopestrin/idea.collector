import { DetailModal } from "@/components/detail/DetailModal";
import { NewProposalForm } from "@/components/proposals/NewProposalForm";

// Intercetta /proposals/new durante la navigazione client dalla board: il
// segmento statico `new` vince sul dinamico [id], quindi niente notFound.
export default function NewProposalModal() {
  return (
    <DetailModal>
      <div className="p-6">
        <NewProposalForm />
      </div>
    </DetailModal>
  );
}
