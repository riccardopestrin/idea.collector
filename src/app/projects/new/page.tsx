import { BackLink } from "@/components/nav/BackLink";
import { NewProjectForm } from "@/components/project/NewProjectForm";
import { STRINGS } from "@/lib/strings";

// Pagina "Nuovo progetto": chi lo crea ne diventa admin (RPC create_project).
export default function NewProjectPage() {
  return (
    <main className="flex flex-1 justify-center p-6">
      <div className="flex w-full max-w-lg flex-col gap-6">
        <BackLink href="/" label={STRINGS.nav.backToProjects} />
        <NewProjectForm />
      </div>
    </main>
  );
}
