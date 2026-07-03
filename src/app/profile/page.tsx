import { redirect } from "next/navigation";

import { NameForm } from "@/components/form/NameForm";
import { GithubRepoSection } from "@/components/profile/GithubRepoSection";
import { type InstallationRepo, listInstallationRepos } from "@/lib/github/app";
import { getGithubSettings } from "@/lib/github/settings";
import { getProfile } from "@/lib/profiles";
import { supabaseServer } from "@/lib/supabase/server";

// Pagina profilo: nome + (per gli admin) configurazione del repository GitHub
// usato come contesto per la valutazione AI (RFC-003).
export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ github?: string }>;
}) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase, user.id);
  const isAdmin = profile?.role === "admin";

  let github: React.ReactNode = null;
  if (isAdmin) {
    const settings = await getGithubSettings(supabase);
    const connected = Boolean(settings?.github_installation_id);
    let repos: InstallationRepo[] = [];
    let loadError: string | undefined;
    if (settings?.github_installation_id) {
      try {
        repos = await listInstallationRepos(settings.github_installation_id);
      } catch (err) {
        console.error("profile github:", err);
        loadError = "Impossibile leggere le repo da GitHub. Riprova o riconnetti.";
      }
    }
    const callbackFailed = (await searchParams).github === "error";
    github = (
      <GithubRepoSection
        connected={connected}
        selectedRepo={
          settings?.github_owner && settings.github_repo
            ? `${settings.github_owner}/${settings.github_repo}`
            : null
        }
        repos={repos}
        loadError={
          loadError ??
          (callbackFailed ? "Connessione GitHub non riuscita. Riprova." : undefined)
        }
      />
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center gap-8 p-6">
      <NameForm heading="Profilo" defaultName={profile?.name ?? undefined} />
      {github}
    </main>
  );
}
