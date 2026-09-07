import { ProjectSettings } from "@/app/projects/[projectId]/settings/ProjectSettings";
import { DetailModal } from "@/components/detail/DetailModal";

// Intercetta /projects/[projectId]/settings durante la navigazione client
// (ingranaggio nel titolo): stesse impostazioni della pagina piena, in overlay
// chiudibile. Il flusso GitHub è un redirect hard e atterra sulla pagina piena.
export default async function ProjectSettingsModal({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  return (
    <DetailModal size="md">
      <div className="p-8">
        <ProjectSettings projectId={(await params).projectId} />
      </div>
    </DetailModal>
  );
}
