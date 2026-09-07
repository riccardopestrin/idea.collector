# 5. Modello dati

Lo schema vive interamente nelle migration SQL in
[`supabase/migrations/`](../../supabase/migrations/) (0001…0026). Questo capitolo
descrive lo **stato finale**. Le migration sono **owner-locked**: le modifichi
solo tramite una nuova migration, e il merge richiede la review dell'owner
([`.claude/rules/change-control.md`](../../.claude/rules/change-control.md)).

## 5.1 Le tabelle

**`profiles`** — profilo applicativo, 1:1 con `auth.users`.
- `id` (PK), `email`, `name` (nullable, ≤ 80 char), `created_at`.
- La FK verso `auth.users` è stata **rimossa** (0024) così il profilo sopravvive
  alla cancellazione dell'account (le proposte restano attribuite).
- **Non c'è più una colonna `role`**: rimossa in 0021, il ruolo è per-progetto.

**`projects`** — una bacheca (tenant).
- `id`, `name` (1–80 char), `created_by`, `created_at`.
- `github_installation_id` / `github_owner` / `github_repo`: la repo collegata
  (nessun secret; scrivibili solo dal server con service-role).

**`project_members`** — membership + ruolo. **Qui vive il modello dei ruoli.**
- PK composta `(project_id, user_id)`, `role` (`'admin' | 'contributor'`, default
  `contributor`).

**`proposals`** — le idee. La tabella più ricca:
- Contenuto: `title`, `description`, `problem`, `links` (text[]), `internal_notes`.
- Autore/stato: `proposer_id`, `status` (default `nuova`), `method` (`rice`|`ice`).
- Scoring: `reach`, `impact`, `confidence`, `effort` (nullable), `ai_rationale`,
  `ai_generated`, `manually_edited`.
- Valutazione AI: `ai_eval_status` (default `assente`), `ai_eval_error`.
- Scan duplicati: `dup_scan_status`, `dup_scan_error`, `dup_flagged`,
  `dup_match_id` (self-FK), `dup_similarity` (0–100), `dup_report`.
- Integrazioni: `git_ref` (branch o `#PR`), `task_url` (solo `app.clickup.com`).
- `project_id` (FK cascade, not null), `created_at`.

**`comments`** — commenti su una proposta.
- `id`, `proposal_id`, `author_id`, `body` (1–4000 char), `created_at`.
- Ancoraggio (0012): `anchor_field` (`description`|`problem`), `anchor_text`,
  `anchor_occurrence` — vincolo "tutte o nessuna".
- `promotion_status` (`none` | `pending` | `accepted`) per la promozione a
  contributo.

**`rice_votes`** — voti dei membri. Un voto per `(proposal, voter)`, **immutabile**
(nessuna policy di update/delete). Componenti 1–10 (`reach` nullable per ICE).

**`status_history`** — audit trail dei cambi di stato: `from_status`, `to_status`,
`author_id`, `created_at`.

> Tabelle eliminate: `tags`/`proposal_tags` (mai usate, rimosse in 0022) e
> `app_settings` (config repo migrata dentro `projects` in 0021).

## 5.2 Gli enum

- **`proposal_status`**: `nuova, in_valutazione, approvata, in_sviluppo,
  rilasciata, archiviata, rifiutata` (`parcheggiata` → `archiviata` in 0007).
- **`scoring_method`**: `rice, ice`.
- **`ai_eval_status`**: `assente, in_corso, completata, fallita` (riusato anche
  per `dup_scan_status`).
- **Ruolo progetto**: check text su `project_members.role` (`admin`|`contributor`).

## 5.3 Il modello RLS

L'autorizzazione a livello di dato ([ADR-0009](../architecture/adr/0009-projects-per-project-roles.md)).
Da 0021 il ruolo è **per-progetto**; le policy si appoggiano a tre helper
SECURITY DEFINER:

- `is_project_member(project)` — l'utente è membro?
- `is_project_admin(project)` — l'utente è admin del progetto?
- `proposal_project(proposal)` — risale al progetto dato l'id proposta.

**Lettura (SELECT):**
- `profiles`: sé stesso o chi condivide almeno un progetto.
- `projects` / `project_members`: solo i membri del progetto.
- `proposals`: solo i membri del progetto.
- `comments` / `rice_votes` / `status_history`: **ereditano** la visibilità dalla
  proposta (la regola sta in un posto solo).

**Scrittura (le regole chiave):**
- `proposals`: insert solo `proposer_id = auth.uid()` + membro; update/delete se
  proposer **o** admin del progetto.
- Colonne privilegiate di `proposals` bloccate dal **trigger
  `enforce_proposal_privileged_columns`**: lo `status` cambia solo via la RPC
  `move_proposal` (GUC transazionale `idea.move_proposal`); i campi AI solo con
  GUC `idea.ai_eval`; i campi dup solo con GUC `idea.dup_scan`; `project_id` è
  bloccato incondizionatamente; `proposer_id`/`method`/`internal_notes` sono
  admin-only.
- `profiles`: l'utente può aggiornare **solo `name`** (grant a colonna, 0003 —
  impedisce l'auto-promozione via PostgREST). L'email la sincronizza un trigger.
- `comments`: insert solo dall'autore, solo su proposta **aperta**
  (`nuova`/`in_valutazione`) e non promossa; edit solo del `body`; delete
  dall'autore (se non `accepted`) o dall'admin di progetto.
- `rice_votes`: insert solo dal votante, solo su proposta `in_valutazione`, mai
  sulla propria, mai se co-autore `accepted`. Niente update/delete.
- `project_members`: gestiti solo dall'admin del progetto, **mai sulla propria
  riga** (non ci si toglie l'accesso da soli).
- `projects`: `name` aggiornabile dai membri; `github_*` solo dal server con
  service-role; delete solo dall'admin del progetto.

**Cristallizzazione** (trigger `enforce_proposal_crystallization`, 0013): oltre
lo stato `in_valutazione` i non-admin non possono più modificare title/
description/problem/links — il contenuto "cristallizza".

**Dove serve il service_role** (0020, [ADR-0008](../architecture/adr/0008-service-role-writes-for-ai-verdicts.md)):
le RPC che scrivono gli esiti AI (`begin/apply/fail_ai_evaluation`,
`begin/apply/fail_dup_scan`) sono ristrette a `service_role`. Così il verdetto AI
lo scrive solo il server ([`src/lib/supabase/admin.ts`](../../src/lib/supabase/admin.ts)),
mai un utente via PostgREST. Idem per la scrittura dei `github_*` e per le
operazioni `auth.admin` (inviti, rimozioni, delete account).

## 5.4 Le RPC principali

Le mutazioni delicate passano da funzioni SECURITY DEFINER **atomiche** con
compare-and-set, non da update grezzi:

- **`move_proposal(id, from, to)`** — l'unica via con cui un non-admin cambia
  stato. Atomica (update + `status_history`), CAS su `from_status`, applica la
  macchina a stati, blocca le proposte `dup_flagged`, richiede membership del
  progetto, resetta subito la GUC.
- **RPC valutazione AI** `begin/apply/fail_ai_evaluation` — una sola valutazione
  in-flight per proposta (`p_force` per recuperare scan orfani da crash); `apply`
  scrive punteggi + rationale con backstop di range 1–10 (rifiuta, non clampa).
- **RPC scan** `begin/apply/fail_dup_scan` — stesso pattern per lo scan
  duplicati/competitor.
- **Promozione commenti** `request/resolve/revoke_comment_promotion` — CAS sullo
  stato di promozione, con guard su commento/proposta aperta/membership.
- **`create_project(name)`** — crea progetto + rende il creatore admin in una
  transazione (necessario: prima dell'insert non è ancora membro).
- **`delete_account()`** — rifiuta se sei l'**unico admin** di un progetto con
  altri membri; elimina i progetti dove sei l'unico membro; anonimizza il
  profilo. La riga `auth.users` la cancella poi la Server Action col service role.
- **`handle_new_user()`** / **`sync_profile_email()`** — trigger su `auth.users`
  che creano il profilo e ne allineano l'email.

## 5.5 La storia delle migration

Una riga per file — utile per capire *perché* una policy è com'è. Molte portano
il numero di un finding di sicurezza (`SEC-N`).

| # | Cosa aggiunge |
|---|---|
| 0001 | Schema MVP: enum, `profiles`/`proposals`/`status_history`, `handle_new_user`, RLS base (ruolo globale). |
| 0002 | Hardening `search_path=''` su funzioni SECURITY DEFINER. |
| 0003 | Lock colonne privilegiate: grant su `profiles.name`, trigger su status/AI. |
| 0004 | Grant DML espliciti ad `authenticated`. |
| 0005 | Introduce `move_proposal` (CAS + history atomici); delete autore-o-admin. |
| 0006 | Indurisce `move_proposal`: reset GUC immediato, rifiuto `from = to`. |
| 0007 | Rinomina enum `parcheggiata` → `archiviata`. |
| 0008 | Check lunghezza `profiles.name` ≤ 80. |
| 0009 | Tabella `comments` + RLS. |
| 0010 | Valutazione AI: enum `ai_eval_status`, colonne AI, `app_settings`, RPC eval. |
| 0011 | `p_force` per recuperare valutazioni bloccate da crash. |
| 0012 | Commenti ancorati a selezioni di testo. |
| 0013 | Re-eval su edit dell'autore + cristallizzazione del contenuto. |
| 0014 | Edit/delete dei propri commenti su proposta aperta. |
| 0015 | Tabella `rice_votes` immutabile. |
| 0016 | Promozione commento → contributo (co-autore). |
| 0017 | Scan duplicati: colonne dup_*, RPC scan, blocco avanzamento flaggati. |
| 0018 | Macchina a stati delle transizioni dentro `move_proposal`. |
| 0019 | GUC `idea.ai_eval` per il path non-admin; backstop range RICE. |
| 0020 | RPC AI → `service_role`; delete commenti altrui admin; colonna `git_ref`. |
| 0021 | **Progetti**: `projects`/`project_members`, ruolo per-progetto, isolamento RLS; drop ruolo globale/`app_settings`. |
| 0022 | Gate membership in `move_proposal`; drop `tags`; lock `project_id`; `github_*` server-only. |
| 0023 | Delete progetto (solo admin del progetto). |
| 0024 | `delete_account` self-service; anonimizzazione profilo. |
| 0025 | Sync `profiles.email` col cambio email in GoTrue. |
| 0026 | Colonna `task_url` (link ClickUp). |

I test pgTAP corrispondenti sono in [`supabase/tests/`](../../supabase/tests/) e
coprono ognuna di queste aree — vedi [capitolo 11](11-testing.md).

---

Precedente: [← 4. Architettura](04-architettura.md) · Prossimo: [6. Autenticazione →](06-autenticazione.md)
