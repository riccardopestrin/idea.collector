# RFC-007: Progetti — più bacheche per account, ruolo per progetto

- **Stato:** Ready — decisioni prese con l'owner il 2026-09-07 (sì a tutti i 4 punti di § Decisioni richieste); [ADR-0009](../adr/0009-projects-per-project-roles.md) in bozza (drafting delegato dall'owner, accettazione = owner).
- **Data:** 2026-09-07
- **Branch:** `projectList` (implementazione nello stesso branch; questo RFC non contiene codice).

## Context

Oggi l'app è **una sola bacheca**: `/` è la board, `profiles.role` (`admin | contributor`) è un ruolo **globale**, `app_settings` è una riga singola con la repo GitHub collegata. `is_admin()` (migration 0001) è la funzione su cui poggiano 6 policy RLS, 3 trigger (`enforce_proposal_privileged_columns`, `enforce_proposal_crystallization`, colonne AI) e 4 RPC (`set_profile_role`, `resolve/revoke_comment_promotion`, `move_proposal` indirettamente).

**Richiesta owner (2026-09-07):** la home diventa una **lista di progetti** (card + "+"). Un account può avere più progetti, ognuno con la propria bacheca (board + classifica, identiche a oggi) e la propria repo GitHub opzionale. **Chi crea il progetto è admin** di quel progetto e **invita** gli altri membri. La bacheca esistente diventa il progetto **"test"** e chi entra la vede come unico elemento della lista. Da una bacheca si torna alla lista.

Il vincolo che cambia tutto: "admin di A, contributor di B" **non è esprimibile con un ruolo globale**. Il ruolo va sul legame utente↔progetto.

## Decisioni proposte

### 1. Modello dati (migration `0021_projects.sql`, owner-locked)

```sql
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  -- repo GitHub collegata: ex app_settings, ora per progetto (nessun secret)
  github_installation_id bigint,
  github_owner text,
  github_repo text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table project_members (
  project_id uuid not null references projects on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'contributor' check (role in ('contributor', 'admin')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

alter table proposals add column project_id uuid not null references projects;
```

**Backfill "test"** nella stessa migration: `insert into projects (name, github_*) select 'test', github_installation_id, github_owner, github_repo from app_settings` (o solo `'test'` se la riga non c'è); tutte le `proposals` prendono quel `project_id`; ogni riga di `profiles` diventa membro di "test" **con il ruolo che ha oggi** (`profiles.role → project_members.role`). Nessun dato perso, nessun cambio di comportamento per chi entra domani.

**Sostituzione di `is_admin()`** con due funzioni `security definer stable`:

```sql
is_project_member(p_project uuid)  -- exists project_members where project_id = p and user_id = auth.uid()
is_project_admin(p_project uuid)   -- ... and role = 'admin'
proposal_project(p_proposal uuid)  -- select project_id from proposals where id = p  (per RPC/trigger che hanno solo l'id proposta)
```

Ogni punto in cui oggi compare `is_admin()` ha **sempre** una proposta a portata di mano (`new.project_id` nei trigger, `p.project_id` nelle RPC che già caricano la proposta), quindi la sostituzione è meccanica: `is_admin()` → `is_project_admin(new.project_id)` / `is_project_admin(proposal_project(c.proposal_id))`.

**RLS — da "tutti gli autenticati leggono tutto" a "solo i membri del progetto":**

| Tabella | Oggi | Domani |
|---|---|---|
| `projects` | — | select: `is_project_member(id)`; insert: `created_by = auth.uid()`; update/delete: `is_project_admin(id)` |
| `project_members` | — | select: `is_project_member(project_id)`; insert/update/delete: `is_project_admin(project_id)` — **eccezione insert**: il creatore inserisce sé stesso come admin (`user_id = auth.uid() and role = 'admin' and exists projects where id = project_id and created_by = auth.uid()`), così la creazione non ha bisogno di service-role |
| `proposals` | select `true` | select: `is_project_member(project_id)`; insert: `proposer_id = auth.uid() and is_project_member(project_id)`; update/delete: `... or is_project_admin(project_id)` |
| `comments`, `rice_votes`, `status_history` | select `true` | select: `exists (select 1 from proposals p where p.id = proposal_id)` — la sub-query è filtrata dalla RLS di `proposals`, quindi eredita la membership senza duplicare la regola. Le policy di scrittura restano uguali salvo `is_admin()` → `is_project_admin(...)` |
| `profiles` | select `true` | select: `id = auth.uid() or exists (select 1 from project_members m1 join project_members m2 using (project_id) where m1.user_id = auth.uid() and m2.user_id = profiles.id)` — non si vedono più le email di utenti con cui non si condivide nulla |
| `app_settings` | riga singola | **drop table** (colonne migrate su `projects`) |
| `tags`, `proposal_tags` | mai usate dal codice | invariate (fuori scope) |

**Cosa si elimina**: `is_admin()`, `set_profile_role` (→ `set_project_role(p_project, p_user, p_role)`, stessa regola "mai su sé stesso", admin del progetto), `app_settings`, e — vedi § Decisioni richieste #1 — la colonna `profiles.role`.

**Test SQL** (`supabase/tests/rls_projects_test.sql`, pgTAP come gli esistenti): membro di A non legge proposte/commenti/voti di B; contributor non scrive `project_members`; creatore diventa admin; admin di A non è admin di B; `set_project_role` non su sé stesso. I 5 file pgTAP esistenti vanno aggiornati: il setup crea un progetto e le membership invece di `update profiles set role = 'admin'`.

### 2. Routing

| URL | Cosa | Note |
|---|---|---|
| `/` | **Lista progetti** (card: nome, repo, n. proposte, tuo ruolo) + "+ Nuovo progetto" | Sostituisce la board. Lista vuota → invito a creare il primo progetto |
| `/projects/new` | Form: nome (obbligatorio), repo GitHub (opzionale, si può collegare dopo dalle impostazioni) | Server Action `createProject`: insert `projects` + insert `project_members (me, admin)`; redirect a `/projects/[id]` |
| `/projects/[id]` | La board di oggi, scoped al progetto | `listProposals(supabase, { projectId, … })` |
| `/projects/[id]/ranking` | La classifica di oggi | idem |
| `/projects/[id]/proposals/new` | Nuova proposta nel progetto | `createProposal` riceve `projectId`; intercettata in modal da `@modal/(.)projects/[id]/proposals/new` |
| `/projects/[id]/settings` | **Impostazioni progetto** (solo admin): membri (invita, ruolo, rimuovi), repo GitHub (connetti/seleziona/scollega), rinomina | Qui migrano `UsersSection` e `GithubRepoSection` dal profilo |
| `/proposals/[id]` | Dettaglio proposta — **resta globale** (l'id è già univoco) | Il modal `@modal/(.)proposals/[id]` continua a intercettare dalla board del progetto senza modifiche. Il progetto si ricava dalla proposta |
| `/profile` | Solo nome utente | Le sezioni admin escono da qui |

`@modal/projects/[id]/page.tsx` (null) chiude il modal quando una action reindirizza alla board del progetto, come oggi fa `@modal/page.tsx` per `/`.

**Header** (`AppHeader`): diventa `← Progetti · <nome progetto> · Board · Classifica · [Impostazioni se admin] · profilo · esci`. Sulla lista progetti mostra solo brand + profilo + esci.

### 3. Servizi e autorizzazione (Server Action)

- `getProfile(...).role` sparisce. Nuovo seam in `src/lib/projects.ts`: `getMembership(supabase, projectId, userId): Role | null` e `listProjects(supabase)` (RLS filtra ai propri).
- I ~12 guard `role !== "admin"` sparsi nelle action diventano **un solo helper** `requireProposalAccess(proposalId)` → `{ user, proposal: { project_id, proposer_id, status }, role }`. Risolve `docs/security/be-careful.md` `2026-07-03-adm1` (guard duplicati), che questa modifica avrebbe altrimenti moltiplicato.
- **Scan duplicati** (`runProposalScan`): i candidati vanno filtrati per `project_id` — oggi confronta con *tutte* le proposte; con più progetti sarebbe un leak cross-progetto nel report di Claude. Con la RLS nuova il client utente vede già solo il proprio progetto, ma il filtro esplicito resta (le proposte di altri progetti a cui l'utente appartiene non sono duplicati).
- **Valutazione AI** (`runEvaluation`): repo letta da `projects` della proposta invece che da `app_settings`.
- **Inviti** (`inviteUser` → `inviteMember(projectId, email, role)`): `auth.admin.inviteUserByEmail` crea l'utente se non esiste (il trigger crea il profilo), poi `insert project_members`. Se l'email è **già registrata** (utente di un altro progetto) GoTrue rifiuta l'invito: si cerca il profilo per email (service-role) e si aggiunge solo la membership. L'invitato atterra su `/` e vede il progetto.
- **GitHub App**: un'installazione per progetto. `startGithubConnect(projectId)` mette il `projectId` nel cookie di stato accanto al nonce; il callback `/auth/github/callback` legge il cookie, verifica `is_project_admin`, scrive su `projects` e reindirizza a `/projects/[id]/settings`.

### 4. Cosa NON cambia

Board, colonne, drag, card, pannello dettaglio, commenti ancorati, voti RICE, promozione commenti, scan, eval, macchina a stati: **identici**. Cambia solo *da dove* arrivano le proposte (progetto) e *chi* è admin (membership).

## Decisioni richieste all'owner

1. **`profiles.role` — eliminare o tenere?** Proposta: **eliminare** (`drop column`) insieme a `is_admin()`. Tenerla creerebbe due fonti di verità sul ruolo e la prima domanda del prossimo reviewer sarebbe "quale conta?". Il grant `update (name)` di 0003 resta valido. Alternativa: tenerla come "super-admin globale" (es. per vedere tutti i progetti) — oggi non c'è un caso d'uso, YAGNI.
2. **Disabilitazione utente (ban)** — oggi "rimuovere" un utente = ban GoTrue perché le FK impedivano il delete. Con le membership, **rimuovere dal progetto = `delete from project_members`**, pulito e reversibile. Proposta: **eliminare `setUserDisabled`** e il flag `disabled` da `UsersSection`. Il ban globale non ha più un "admin globale" che lo eserciti (vedi #1).
3. **URL del dettaglio proposta** — proposta: **resta `/proposals/[id]`** (modal intercept invariato, zero churn su link/redirect esistenti, `dup_match` continua a linkare tra proposte). Alternativa `/projects/[pid]/proposals/[id]`: URL più "parlante" ma sposta il modal sotto `projects/[id]/@modal` e tocca ogni link.
4. **Migration sul remoto**: 0021 presuppone 0020 applicata (`SEC-9`: in attesa di `db push` + `SUPABASE_SERVICE_ROLE_KEY` in env, vedi `docs/security/issues.md`). Il `db push` di 0020+0021 va fatto insieme; è un'azione owner.

## ADR da scrivere (owner): ADR-0009

Bozza da incollare in `docs/architecture/adr/0009-projects-per-project-roles.md` (il file lo crea e accetta l'owner):

> **ADR-0009: Progetti come tenant, ruolo per progetto**
> - Stato: Proposed · Data: 2026-09-07
>
> **Context.** L'app nasce con una sola bacheca e un ruolo globale su `profiles.role`. Serve più bacheche per account, ciascuna con la propria repo, dove chi crea il progetto è admin e invita gli altri (RFC-007).
>
> **Decision.** Introdurre `projects` e `project_members(project_id, user_id, role)`; `proposals.project_id not null`. Il ruolo vive **solo** sulla membership: `is_admin()` è sostituita da `is_project_admin(project_id)` / `is_project_member(project_id)`; `profiles.role` e `app_settings` vengono eliminate (repo GitHub su `projects`). RLS: lettura e scrittura scoped alla membership; comments/votes/history ereditano la visibilità dalla policy di `proposals`. La bacheca esistente è migrata nel progetto "test" con le membership ricavate dai ruoli attuali. Il dettaglio proposta resta all'URL globale `/proposals/[id]`.
>
> **Consequences.** (+) Isolamento dati tra progetti enforced a DB; un utente può avere ruoli diversi in progetti diversi; "rimuovere un membro" diventa un delete di membership, non un ban. (−) Ogni tabella futura legata a una proposta deve ereditare la visibilità via `proposals`; le policy/RPC esistenti vanno riscritte in una migration corposa (0021) e i 5 test pgTAP aggiornati; il flusso GitHub App gestisce un'installazione per progetto. Non esiste più un admin "globale": chi deve vedere tutto va aggiunto a ogni progetto.
>
> **Source.** Richiesta owner 2026-09-07, RFC-007.

## Scostamenti in implementazione (2026-09-07)

- **Rinomina progetto**: non implementata (non richiesta dall'owner; la policy `admin update` su `projects` la consente già, manca solo la UI).
- **`set_project_role` RPC**: non serve — ruolo e rimozione membri sono policy dichiarative su `project_members` (`admin update others` / `admin delete others`, mai sulla propria riga). La creazione passa invece dalla RPC `create_project` (definer), che sostituisce l'"eccezione insert" del creatore.
- **`proposals.project_id`** ha `on delete cascade`: il progetto è la bacheca, eliminarlo porta via le sue proposte.
- **`requireProposalAccess`** non estratto: i guard sono stati riscritti 1:1 con `isProjectAdmin(supabase, proposal.project_id, userId)`; `be-careful 2026-07-03-adm1` resta aperta (estesa).
- **`@modal/projects/[id]/page.tsx`** non aggiunto: nessuna action reindirizza alla board mentre un modal è aperto.
- **Nuova proposta**: `/projects/[id]/proposals/new` intercettata da `@modal/(.)projects/[projectId]/proposals/new`; il dettaglio resta `/proposals/[id]` con `@modal/(.)proposals/[id]` invariato.

- **Migration 0022** (review chain + Security Expert 2026-09-07, non ancora pushata): gate di membership in `move_proposal` e in `promotion_target`; lock di `project_id` come primo statement del trigger (SEC-12); colonne `github_*` di `projects` scrivibili solo dal server via service-role (SEC-13 parziale); drop di `tags`/`proposal_tags` (schema morto).

## Piano di implementazione (dopo ADR)

1. `supabase/migrations/0021_projects.sql` + `supabase/tests/rls_projects_test.sql` + aggiornamento dei 5 pgTAP esistenti; `pnpm exec supabase db reset` in locale e `supabase test db`.
2. `src/lib/projects.ts` (tipi, `listProjects`, `getMembership`, `createProject`-side data), `src/lib/github/settings.ts` → legge/scrive `projects`.
3. Route: `/` lista, `/projects/new`, `/projects/[id]` (board), `/projects/[id]/ranking`, `/projects/[id]/proposals/new` (+ intercept modal), `/projects/[id]/settings`; `AppHeader`, `BackLink` parametrici; `@modal/projects/[id]/page.tsx`.
4. Server Action: `createProject`, `renameProject`, `inviteMember`, `setMemberRole`, `removeMember`; `createProposal(projectId)`; helper `requireProposalAccess`; GitHub connect/callback con `projectId`; `runProposalScan` filtrato per progetto; `runEvaluation` legge la repo dal progetto.
5. Test Vitest: `projects.test.ts`, action test aggiornati (mock membership invece di `profiles.role`), `ProjectCard`/`ProjectList` component test, `proxy.test.ts` invariato.
6. `pnpm test`, `pnpm exec eslint src/`, review chain (`/review-chain`, su conferma dell'owner), Security Expert; aggiornamento `docs/security/be-careful.md` (`2026-07-03-adm1` → risolto) e `README.md`.
