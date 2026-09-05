import { redirect } from "next/navigation";

import { NameForm } from "@/components/form/NameForm";
import { BackLink } from "@/components/nav/BackLink";
import { GithubRepoSection } from "@/components/profile/GithubRepoSection";
import { type UserRow, UsersSection } from "@/components/profile/UsersSection";
import { type InstallationRepo, listInstallationRepos } from "@/lib/github/app";
import { connectedRepo, getGithubSettings } from "@/lib/github/settings";
import { getProfile } from "@/lib/profiles";
import { STRINGS } from "@/lib/strings";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

// Pagina profilo: nome + (per gli admin) utenti/inviti e configurazione del
// repository GitHub usato come contesto per la valutazione AI (RFC-003).
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

  let users: React.ReactNode = null;
  let github: React.ReactNode = null;
  if (isAdmin) {
    // lo stato "disabilitato" (ban) vive solo in auth.users: lettura service-role
    const [{ data: profiles }, { data: auth }] = await Promise.all([
      supabase.from("profiles").select("id, email, name, role").order("created_at"),
      supabaseAdmin().auth.admin.listUsers({ perPage: 1000 }),
    ]);
    // ban_duration "none" azzera banned_until; qui si usano solo ban ~permanenti
    const disabled = new Set(auth?.users.filter((u) => u.banned_until).map((u) => u.id));
    const rows: UserRow[] = ((profiles ?? []) as Omit<UserRow, "disabled">[]).map((p) => ({
      ...p,
      disabled: disabled.has(p.id),
    }));
    users = <UsersSection users={rows} currentUserId={user.id} />;

    const settings = await getGithubSettings(supabase);
    const repo = connectedRepo(settings);
    const connected = Boolean(settings?.github_installation_id);
    let repos: InstallationRepo[] = [];
    let loadError: string | undefined;
    if (settings?.github_installation_id) {
      try {
        repos = await listInstallationRepos(settings.github_installation_id);
      } catch (err) {
        console.error("profile github:", err);
        loadError = STRINGS.github.reposLoadFailed;
      }
    }
    const callbackFailed = (await searchParams).github === "error";
    github = (
      <GithubRepoSection
        connected={connected}
        selectedRepo={repo ? `${repo.owner}/${repo.name}` : null}
        repos={repos}
        loadError={
          loadError ??
          (callbackFailed ? STRINGS.github.connectFailed : undefined)
        }
      />
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center gap-8 p-6">
      <div className="w-full max-w-lg">
        <BackLink />
      </div>
      <NameForm heading={STRINGS.profile.heading} defaultName={profile?.name ?? undefined} />
      {users}
      {github}
    </main>
  );
}
