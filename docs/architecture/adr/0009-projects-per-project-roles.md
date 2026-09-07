# ADR-0009: Progetti come tenant, ruolo per progetto

- **Stato:** Proposed
- **Data:** 2026-09-07

## Context

L'app nasce con una sola bacheca e un ruolo globale su `profiles.role` (`admin | contributor`, migration 0001). `is_admin()` è la funzione su cui poggiano le policy RLS, i trigger sulle colonne privilegiate e le RPC di promozione commenti. Serve più bacheche per account, ciascuna con la propria repo GitHub, dove chi crea il progetto è admin e invita gli altri ([RFC-007](../rfc/RFC-007-projects-multi-board.md)). "Admin di A, contributor di B" non è esprimibile con un ruolo globale.

## Decision

- Nuove tabelle `projects` (nome + repo GitHub collegata, ex `app_settings`) e `project_members(project_id, user_id, role)`; `proposals.project_id not null`.
- Il ruolo vive **solo** sulla membership. `is_admin()` è sostituita da `is_project_admin(project_id)` / `is_project_member(project_id)`; `profiles.role`, `app_settings` e `set_profile_role` vengono eliminate.
- RLS scoped alla membership: `proposals` leggibili/scrivibili solo dai membri del progetto; `comments`, `rice_votes`, `status_history` ereditano la visibilità con una sub-query su `proposals` (filtrata dalla RLS di `proposals`), senza duplicare la regola; `profiles` visibili solo tra co-membri.
- La creazione di un progetto passa dalla RPC `create_project(name)` (security definer: insert progetto + membership admin del creatore in una transazione). Ruolo e rimozione dei membri sono policy dichiarative su `project_members` (admin del progetto, mai su sé stesso). "Rimuovere un membro" = delete della membership: la disabilitazione globale (ban GoTrue) sparisce.
- La bacheca esistente è migrata nel progetto "test" con le membership ricavate dai ruoli attuali, nella stessa migration (0021).
- Il dettaglio proposta resta all'URL globale `/proposals/[id]`; board, classifica, nuova proposta e impostazioni vivono sotto `/projects/[id]`.

## Consequences

- (+) Isolamento dati tra progetti enforced a DB; un utente può avere ruoli diversi in progetti diversi; la GitHub App è installabile per progetto.
- (+) Rimozione di un membro reversibile e senza toccare l'audit trail (le FK verso `profiles` restano).
- (−) Ogni tabella futura legata a una proposta deve ereditare la visibilità via `proposals`.
- (−) Non esiste più un admin "globale": chi deve vedere tutto va aggiunto a ogni progetto.
- (−) Ogni utente autenticato può creare progetti e quindi invitare (creazione account via service-role): l'esistenza di un account è deducibile dall'esito dell'invito. Accettabile finché l'app resta invite-only tra persone fidate (be-careful `2026-09-07-inv1`).
- (−) Le policy/RPC esistenti sono riscritte in una migration corposa (0021) e i test pgTAP creano un progetto nel setup invece di `update profiles set role`.

## Source

Richiesta owner 2026-09-07; RFC-007; ADR-0001 (auth), ADR-0004 (GitHub App), ADR-0008 (service-role: invariato, le RPC di scan/eval restano eseguibili solo da `service_role`).

## If we were starting today

Stessa scelta: la membership è il modello minimo che esprime il requisito. Con più tenant fin dall'inizio `app_settings` non sarebbe mai nata come riga singola.
