import { AppHeader } from "@/components/nav/AppHeader";

import { loadProject } from "./project";

// Layout di un progetto: header con nome, nav Board/Classifica (+ Impostazioni
// per l'admin) e ritorno alla lista. Le pagine sotto rendono solo il <main>.
export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { user, project, role, profile } = await loadProject((await params).projectId);

  return (
    <>
      <AppHeader
        profileLabel={profile?.name ?? user.email}
        project={{ id: project.id, name: project.name, isAdmin: role === "admin" }}
      />
      {children}
    </>
  );
}
