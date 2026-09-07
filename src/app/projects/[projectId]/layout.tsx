import { AppHeader } from "@/components/nav/AppHeader";

import { loadProject } from "./project";

// Layout di un progetto: header con freccina di ritorno e nav Board/Classifica.
// Nome progetto + rotella impostazioni vivono nel titolo di pagina (ProjectHeading).
// Le pagine sotto rendono solo il <main>.
export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { user, project, profile } = await loadProject((await params).projectId);

  return (
    <>
      <AppHeader
        profileLabel={profile?.name ?? user.email}
        project={{ id: project.id, name: project.name }}
      />
      {children}
    </>
  );
}
