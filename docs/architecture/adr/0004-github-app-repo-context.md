# ADR-0004: Integrazione GitHub via GitHub App per il contesto del progetto

- **Stato:** Proposed
- **Data:** 2026-07-03

## Context

La valutazione RICE ha bisogno del contesto del repository del progetto (README, struttura, linguaggi, attività) — vedi [RFC-003](../rfc/RFC-003-ai-rice-evaluation-github.md). Serve leggere una repo GitHub, **anche privata**, dal server. È una nuova integrazione esterna con gestione di credenziali, quindi richiede una ADR ([`adr-when-to-write.md`](../../../.claude/rules/adr-when-to-write.md)). Da fissare: come autenticarsi verso GitHub, dove vivono i segreti, quanto accesso concedere.

Alternative valutate: **PAT** (semplice ma token longevo da custodire, accesso ampio, nessun "connetti" da UI); **OAuth App** (pulsante "connetti" ma scope `repo` ampio a tutte le repo dell'utente + token longevo salvato); **GitHub App** (connetti + scelta granulare della singola repo, token a scadenza breve).

## Decision

Usare una **GitHub App** in sola lettura.

- **Registrazione one-time** (owner): App con permessi **Contents: Read** + **Metadata: Read**, callback URL configurabile (localhost in dev + produzione, più callback sulla stessa App). Segreti in `.env.local`: `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY` (PEM), `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_CALLBACK_URL`.
- **Collegamento da UI** (area profilo, admin-only): "Connetti GitHub" → l'admin **autorizza** l'App sulla repo scelta su github.com → callback salva il solo `installation_id` (identificativo dell'autorizzazione, **non un secret**) e la repo (`owner/name`) in `app_settings`.
- **Accesso runtime:** i **token di accesso alla repo** si generano al volo firmando un JWT con la private key (installation token, ~1h) — **nessun token longevo salvato nel DB**.
- **Nessun webhook:** i token si generano a richiesta; GitHub non deve raggiungere il server (sviluppo su localhost senza tunnel).

## Consequences

**Positive:** accesso **granulare alla sola repo scelta, read-only** (blast radius minimo); nessun token longevo nel DB (solo `installation_id` non-secret; il segreto è la private key in env); UX "connetti e scegli" dalla UI; una sola App copre dev e produzione.
**Negative:** lock-in su GitHub e sul modello GitHub App; registrazione one-time a carico dell'owner; da presidiare la custodia della private key, la validazione del callback e l'accesso admin-only alle Server Action (segnalato al `Security Expert`); logica di firma JWT + refresh del token di accesso.

## Source

Richiesta dell'owner (2026-07-03) di collegare un repo (anche privato) e darne il contesto a Claude; scelta del modello di auth discussa in sessione di planning; scoping in [RFC-003](../rfc/RFC-003-ai-rice-evaluation-github.md).

## If we were starting today

Sì, per repo private con accesso granulare la GitHub App è lo standard. Un PAT sarebbe accettabile solo per un MVP a repo pubblica; l'OAuth App è scartata perché lo scope `repo` classico è troppo ampio. Rivedere se in futuro servissero più repo/più org contemporaneamente (l'`installation_id` per riga già lo permetterebbe con poco lavoro).
