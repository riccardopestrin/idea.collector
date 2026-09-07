import { ProjectSettings } from "./ProjectSettings";

// Pagina piena delle impostazioni progetto: fallback per navigazione diretta,
// refresh e ritorno dal callback GitHub (?github=error). Di norma si aprono
// nell'overlay @modal/(.)projects/[projectId]/settings dall'ingranaggio.
export default async function ProjectSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ github?: string }>;
}) {
  const { projectId } = await params;
  const githubCallbackFailed = (await searchParams).github === "error";

  return (
    <main className="flex flex-1 flex-col items-center p-6">
      <ProjectSettings projectId={projectId} githubCallbackFailed={githubCallbackFailed} />
    </main>
  );
}
