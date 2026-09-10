# 3. Avvio in locale

Questo capitolo ti porta da zero a un'app funzionante sul tuo computer, con uno
stack Supabase completamente locale (Postgres, Auth, email di test). Segui i
passi nell'ordine.

## 3.1 Prerequisiti

| Strumento | Versione | Note |
|---|---|---|
| **Node.js** | ≥ 20 (LTS) | Next 16 + React 19. Testato con Node 26. |
| **pnpm** | ≥ 9 | Il package manager del progetto. `corepack enable` lo installa. |
| **Docker Desktop** | recente, **acceso** | Serve allo stack Supabase locale. |
| **Supabase CLI** | — | Già una devDependency: si usa via `pnpm exec supabase`. |

> **Regola del progetto: si usa `pnpm`, mai `npm`.** Niente `package-lock.json`.
> Il lockfile è `pnpm-lock.yaml`. Vedi
> [`.claude/rules/package-manager.md`](../../.claude/rules/package-manager.md).

Tutti i comandi si lanciano dalla **radice del repo**. Non esiste una
sottocartella `web/`.

## 3.2 Installa le dipendenze

```bash
pnpm install
```

## 3.3 Avvia lo stack Supabase locale

Con Docker Desktop acceso:

```bash
pnpm db:start                 # avvia Postgres + API + Auth + Mailpit in Docker
pnpm exec supabase db reset   # crea il DB applicando TUTTE le migration di supabase/migrations
```

`db reset` è il comando che ti dà un database pulito e allineato: applica in
ordine tutte le migration `0001…0031`. Rilancialo ogni volta che vuoi ripartire
da uno schema pulito.

Per vedere le credenziali e gli URL dello stack locale:

```bash
pnpm exec supabase status
```

Segnati questi tre valori — servono per `.env.local`:

- **API URL** → `NEXT_PUBLIC_SUPABASE_URL` (tipicamente `http://127.0.0.1:54321`)
- **anon key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

Altri URL utili dello stack locale:

- **Supabase Studio** (GUI del DB): stampato da `status`, di solito `http://127.0.0.1:54323`
- **Mailpit** (cattura le email locali, es. gli inviti): `http://127.0.0.1:54324`

## 3.4 Configura le variabili d'ambiente

Copia il template e riempi `.env.local` (che **non** è committato):

```bash
cp .env.example .env.local
```

Compila almeno le due variabili Supabase pubbliche e la service-role con i valori
di `supabase status`. Ecco cosa vuole ogni variabile (il template completo è in
[`.env.example`](../../.env.example)):

| Variabile | Obbligatoria? | A cosa serve |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | URL dell'API Supabase. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Chiave pubblica lato client. |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ (per inviti/AI) | Solo lato server. Scrive esiti AI, gestisce utenti. **Mai al client.** |
| `ANTHROPIC_API_KEY` | opzionale | Valutazione AI e scan reali. Senza, usa gli stub (vedi sotto). |
| `AI_EVAL_FAKE` | opzionale | `1` = salta Claude, salva punteggi fittizi. Utile senza crediti API. |
| `AI_SCAN_FAKE` | opzionale | `1` = salta lo scan reale, report fittizio senza match. |
| `GITHUB_APP_ID` / `GITHUB_APP_SLUG` / `GITHUB_APP_PRIVATE_KEY` | opzionale | Contesto repo via GitHub App. Solo lato server. |

> **Regola di sicurezza del repo:** non leggere mai `.env.local` (contiene i
> segreti veri) — solo `.env.example` è consultabile. Se manca una variabile in
> `.env.example`, si aggiunge lì con un placeholder, non si inventa un valore.
> Vedi [`.claude/rules/host-machine-safety.md`](../../.claude/rules/host-machine-safety.md).

### Demo senza chiave Anthropic

Se non hai una `ANTHROPIC_API_KEY`, imposta:

```dotenv
AI_EVAL_FAKE=1
AI_SCAN_FAKE=1
```

L'app girerà completa: la valutazione e lo scan restituiranno risultati fittizi
ma il resto della pipeline (stati, persistenza, UI) è quello vero.

## 3.5 Avvia l'app

```bash
pnpm dev
```

Apri **http://localhost:3000**. Il server ricarica a caldo a ogni modifica.

## 3.6 Crea il primo utente e accedi

L'accesso è **solo su invito** (niente registrazione aperta): la pagina di login
manda un magic link e non crea utenti nuovi. In locale il modo più semplice per
avere un utente è crearlo da Supabase Studio o via invito.

**Percorso invito (consigliato, riproduce la produzione):**

1. Serve già un utente admin di un progetto per invitare. Al primo avvio non ce
   n'è: crea il primo utente da **Supabase Studio → Authentication → Users → Add
   user** (con email confermata), poi fai login (§sotto).
2. Crea un progetto dall'app (diventi automaticamente admin di quel progetto).
3. Da **Profilo → Utenti** invita altri con la loro email:
   `auth.admin.inviteUserByEmail`. In locale l'email arriva su **Mailpit**
   (`http://127.0.0.1:54324`): apri il messaggio e clicca il link d'invito.

**Login:** su `/login` inserisci l'email; arriva un magic link (su Mailpit in
locale). Il link porta a `/auth/callback` che stabilisce la sessione. Se il
profilo non ha ancora un nome, vieni mandato all'**onboarding** per impostarlo.

Il dettaglio del flusso di auth è nel [capitolo 6](06-autenticazione.md).

## 3.7 Chiudere e ripartire

```bash
pnpm db:stop     # ferma i container Supabase
```

I dati locali sopravvivono tra `db:start`/`db:stop`. Per azzerare lo schema e i
dati e riapplicare le migration: `pnpm exec supabase db reset`.

## 3.8 Comandi di uso quotidiano

```bash
pnpm dev                        # dev server Next su :3000
pnpm build                      # build di produzione
pnpm test                       # unit + component (Vitest), one-shot
pnpm test:watch                 # Vitest in watch
pnpm exec eslint src/           # lint
pnpm db:start / pnpm db:stop    # stack Supabase locale
pnpm exec supabase db reset     # ricrea il DB dalle migration
pnpm exec supabase test db      # test RLS pgTAP (supabase/tests)
pnpm test:integration           # scenario full-stack su RLS/RPC reali (richiede stack locale)
```

Testing in dettaglio nel [capitolo 11](11-testing.md).

## 3.9 Problemi comuni

- **`pnpm db:start` fallisce** → Docker Desktop non è acceso.
- **L'app non parte / errori Supabase** → `.env.local` non compilato o valori non
  allineati a `supabase status`.
- **Il login non arriva** → in locale le email sono su Mailpit, non nella tua
  casella reale.
- **Valutazione AI in errore** → manca `ANTHROPIC_API_KEY`; imposta
  `AI_EVAL_FAKE=1`/`AI_SCAN_FAKE=1` per la demo.
- **Test d'integrazione rifiutati** → puntano di proposito solo a un'istanza
  locale (creano e cancellano utenti veri `*@test.local`).

---

Precedente: [← 2. Concetti](02-concetti.md) · Prossimo: [4. Architettura →](04-architettura.md)
