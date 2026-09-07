# 4. Architettura

## 4.1 Lo stack

- **Next.js 16** (App Router, React 19, React Compiler abilitato in
  [`next.config.ts`](../../next.config.ts)). Server Components per la lettura,
  Server Actions per le mutazioni.
- **Supabase**: Postgres + Auth ([ADR-0001](../architecture/adr/0001-supabase-postgres-auth.md)).
  L'autorizzazione vive nelle **RLS policy** e in funzioni SECURITY DEFINER.
- **Tailwind CSS v4** con un set di token condivisi in [`src/lib/tokens.ts`](../../src/lib/tokens.ts).
- **Tiptap 3** per l'editor rich-text, con storage in markdown ([ADR-0005](../architecture/adr/0005-tiptap-editor-anchored-comments.md)).
- **Anthropic SDK** (Claude) per valutazione e scan ([ADR-0003](../architecture/adr/0003-anthropic-ai-scoring-provider.md)).
- **GitHub App** per il contesto repo ([ADR-0004](../architecture/adr/0004-github-app-repo-context.md)).
- **Vitest** + React Testing Library (unit/component) e **pgTAP** (RLS).

> Questa **non** è la Next.js che conosci a memoria: ci sono breaking change di
> API e convenzioni. Prima di scrivere codice, leggi la guida pertinente in
> `node_modules/next/dist/docs/`. È la regola in [`AGENTS.md`](../../AGENTS.md).

## 4.2 L'architettura a livelli

Il cuore del design è in [`.claude/rules/layered-architecture.md`](../../.claude/rules/layered-architecture.md).
Tre livelli, ognuno con **un solo compito**, con le dipendenze che puntano verso
l'interno:

| Livello | Dove | Il suo unico compito |
|---|---|---|
| **Transport** | `proxy.ts`, Route Handler (`**/route.ts`), entry di pagina/Server Component | **Autentica.** Risolve la sessione Supabase nell'utente corrente e mappa gli errori in risposte (status, redirect, stato del form). Nessuna regola di business. |
| **Application / use-case** | Server Action (`"use server"`), funzioni in `src/lib` | **Autorizza** ed **applica le regole di business.** Controlla ruolo e ownership, verifica le precondizioni, orchestra le chiamate al DB. |
| **Data** | query Supabase (`src/lib/supabase/*`) + **RLS policy** in `supabase/migrations/` | **Resta muto.** Legge e scrive. Le RLS sono la **rete di sicurezza enforced**: l'ultima linea che tiene anche se una guardia sopra viene dimenticata. |

**Autenticazione ≠ autorizzazione.** L'autenticazione risolve *chi* è la
richiesta (transport). L'autorizzazione decide *se* può fare l'operazione
(service **e** RLS). Nascondere un bottone nella UI non è autorizzazione.

### Dove va un concern?

Decidi in base allo *scope* a cui il concern è deciso:

1. **Una volta per richiesta, legato al protocollo/identità** → transport
   (`proxy.ts` o cima del Route Handler/pagina). Es. refresh della sessione,
   redirect dei non autenticati.
2. **Per operazione, come regola di business testabile** → Server Action/service.
   Es. `if (role !== 'admin') throw …`, **con dietro una policy RLS**.
3. **Pura lettura/scrittura** → data layer, con RLS come backstop.
4. **Noto allo startup** → configurazione d'ambiente, letta dai wrapper Supabase.
   I segreti `process.env` non si leggono ad hoc dentro un componente.

Se un concern verrebbe copiato a ogni call site, dagli **una sola cucitura
esplicita**: una funzione in `src/lib` che tutti chiamano. Sempre una chiamata
esplicita, mai un wrapper "furbo".

## 4.3 La mappa del repository

```
src/
├─ app/                      # App Router: routing, pagine, Server Actions, Route Handler
│  ├─ layout.tsx             # root layout + slot parallelo @modal
│  ├─ page.tsx               # home autenticata = lista progetti
│  ├─ login/                 # login passwordless (client)
│  ├─ onboarding/            # imposta il nome se manca
│  ├─ auth/callback/         # scambio magic link / verifica invito (route handler)
│  ├─ auth/github/callback/  # callback GitHub App (route handler)
│  ├─ profile/               # profilo + actions (nome, elimina account)
│  ├─ projects/              # lista/creazione progetti + actions (membri, GitHub, delete)
│  │  └─ [projectId]/        # board, ranking, settings, nuova proposta
│  ├─ proposals/             # dettaglio proposta (pagina piena) + actions (stato, voti, commenti…)
│  └─ @modal/                # intercepting routes: dettaglio/profilo/nuova-proposta in overlay
├─ components/               # UI: board, cards, detail, editor, form, nav, project, filters…
├─ lib/                      # logica applicativa e data layer
│  ├─ supabase/              # i tre client: server / client / admin
│  ├─ ai/                    # valutazione + scan (Claude)
│  ├─ github/                # GitHub App, digest repo, settings
│  ├─ board.ts               # macchina a stati + raggruppamento colonne
│  ├─ proposals.ts           # tipi e query delle proposte
│  ├─ projects.ts            # query dei progetti/membership
│  ├─ anchors.ts             # proiezione testo + risoluzione ancore (server)
│  └─ tokens.ts              # class-string/token condivisi (no valori inline)
└─ proxy.ts                  # ex-middleware Next 16: refresh sessione + gate auth

supabase/
├─ migrations/               # 0001…0026, la storia dello schema (owner-locked)
├─ tests/                    # test RLS pgTAP
├─ templates/                # template email (invito, cambio email)
└─ config.toml               # config stack locale
```

## 4.4 Le convenzioni di routing di Next 16

Due convenzioni sorprendono chi arriva da Next più vecchi:

- **`src/proxy.ts` è l'ex-middleware.** In Next 16 il file si chiama `proxy` ed
  esporta `proxy(request)` + `config.matcher`. Fa solo transport/auth.
- **Parallel + intercepting routes** in `src/app/@modal/`. Il dettaglio di una
  proposta è insieme un **overlay** (quando ci arrivi cliccando dalla board) e una
  **pagina piena** (link diretto/refresh), condividendo lo stesso componente.
  Dettagli nel [capitolo 7](07-proposte-e-board.md).

## 4.5 Dove *non* mettere le cose (errori bloccati dalla review)

Il Software Reviewer segnala come finding IMPORTANT ognuno di questi:

- Un check di ruolo solo dentro un componente React (bottone nascosto) senza
  guardia nella Server Action **e** senza policy RLS.
- Logica di business dentro un Route Handler o `proxy.ts`.
- Una mutazione che richiede autorizzazione fatta direttamente da un Server
  Component invece che da una Server Action.
- Una scrittura privilegiata protetta *solo* da una guardia TypeScript, senza RLS
  dietro.
- Una nuova "macchina" per l'autorizzazione (permission engine, ACL, DI
  container): una guardia semplice + una policy RLS sono l'intero meccanismo.
- Un segreto `process.env` letto sotto il livello transport/config.

Quando una richiesta metterebbe un concern nel layer sbagliato, la si contesta e
si propone l'alternativa nel layer giusto — vedi
[`.claude/rules/defend-separation-of-concerns.md`](../../.claude/rules/defend-separation-of-concerns.md).

---

Precedente: [← 3. Avvio in locale](03-avvio-locale.md) · Prossimo: [5. Modello dati →](05-modello-dati.md)
