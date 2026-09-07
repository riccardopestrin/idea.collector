import { BackLink } from "@/components/nav/BackLink";
import { NewProposalForm } from "@/components/proposals/NewProposalForm";
import { STRINGS } from "@/lib/strings";

import { loadProject } from "../../project";

// Fallback per navigazione diretta/hard-nav: la creazione normale avviene
// nell'overlay @modal/(.)projects/[projectId]/proposals/new.
export default async function NewProposalPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { project } = await loadProject((await params).projectId);

  return (
    <main className="flex flex-1 justify-center p-6">
      <div className="flex w-full max-w-lg flex-col gap-6">
        <BackLink href={`/projects/${project.id}`} label={STRINGS.nav.backToBoard} />
        <NewProposalForm projectId={project.id} />
      </div>
    </main>
  );
}
