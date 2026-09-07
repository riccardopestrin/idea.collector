import { DetailModal } from "@/components/detail/DetailModal";
import { NewProjectForm } from "@/components/project/NewProjectForm";

// Intercetta /projects/new durante la navigazione client (bottone nella
// pagina principale): stesso form della pagina piena, in overlay chiudibile.
export default function NewProjectModal() {
  return (
    <DetailModal size="md">
      <div className="p-8">
        <NewProjectForm />
      </div>
    </DetailModal>
  );
}
