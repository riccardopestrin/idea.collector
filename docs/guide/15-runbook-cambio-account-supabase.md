# 15. Runbook — cambiare account Supabase

Questo è un **runbook operativo**, non un capitolo narrativo: la procedura per
portare l'app su un **altro account/progetto Supabase** — un fork, un nuovo
tenant, o semplicemente un'altra dashboard con altre credenziali. Lo scenario è
*indolore* perché il codice applicativo non cambia di una riga: le uniche
coordinate verso il tuo progetto sono tre variabili d'ambiente, e lo schema con
le sue RLS si ricrea applicando le migration.

> **Cambiare *account* Supabase (questo capitolo) ≠ cambiare *sistema di DB*.**
> Restare su Supabase con un altro progetto è la procedura qui sotto. Sostituire
> Supabase con un altro backend (altro Postgres, un altro BaaS, un'altra auth)
> tocca ~46 file, riscrive le RLS e la superficie di autenticazione, ed è un
> cambio che **attraversa un confine architetturale**: richiede una ADR
> ([`.claude/rules/adr-when-to-write.md`](../../.claude/rules/adr-when-to-write.md))
> e non è un runbook.

## 15.1 Cosa cambia e cosa resta uguale

| | Elemento | Nota |
|---|---|---|
| **Cambia** | `NEXT_PUBLIC_SUPABASE_URL` | Dal nuovo progetto (Settings → API). |
| **Cambia** | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Idem. |
| **Cambia** | `SUPABASE_SERVICE_ROLE_KEY` | Idem. Server-only, **mai** in una var `NEXT_PUBLIC_`. |
| **Cambia** | `project_id` in [`supabase/config.toml`](../../supabase/config.toml) | Solo etichetta per la CLI locale, non runtime. |
| **Cambia** | Config Auth nella dashboard nuova | Redirect URL, SMTP, template email. |
| **Resta** | Schema, RLS, RPC, trigger | Ricreati applicando le migration, non riscritti. |
| **Resta** | `ANTHROPIC_API_KEY` | Non è legata all'account Supabase. |
| **Resta** | `GITHUB_APP_ID` / `GITHUB_APP_SLUG` / `GITHUB_APP_PRIVATE_KEY` | La GitHub App del contesto repo è indipendente. |

Le variabili complete e il loro significato sono in
[`.env.example`](../../.env.example) e nel [capitolo 12](12-deploy.md).

## 15.2 Fork del repo

```bash
gh repo fork riccardopestrin/idea.collector --clone
cd idea.collector
pnpm install
```

> Si usa `pnpm`, mai `npm`
> ([`.claude/rules/package-manager.md`](../../.claude/rules/package-manager.md)).

## 15.3 Crea il nuovo progetto Supabase

Nella dashboard del **nuovo account** → *New project*. Segna:

- **Project Ref** — l'ID nell'URL `supabase.com/dashboard/project/<REF>`.
- **Database password** — serve per il link della CLI.

Da *Settings → API* prendi **Project URL**, **anon public key**, **service_role
key**.

## 15.4 Collega la CLI e applica le migration

```bash
pnpm exec supabase login
pnpm exec supabase link --project-ref <NUOVO_REF>
pnpm exec supabase db push
```

`db push` applica in ordine tutte le migration di `supabase/migrations/`
(oggi `0001_init.sql … 0030_realtime_publication.sql`): schema, grant, RLS,
trigger e la publication realtime. Deve arrivare in fondo **senza errori** — se
una migration fallisce ti fermi lì, lo schema resta a metà e non c'è un rollback
parziale pulito. Aggiorna anche `project_id` in
[`supabase/config.toml`](../../supabase/config.toml) se vuoi che rispecchi il
nuovo progetto.

> `supabase/migrations/` è owner-locked
> ([`.claude/rules/change-control.md`](../../.claude/rules/change-control.md)): qui
> non stai *modificando* migration, le stai solo **applicando** a un progetto
> nuovo.

## 15.5 Variabili d'ambiente in locale

```bash
cp .env.example .env.local
```

In `.env.local` metti i **tre valori Supabase nuovi**; Anthropic e GitHub App
restano quelli di prima:

```
NEXT_PUBLIC_SUPABASE_URL=https://<NUOVO_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<nuova anon key>
SUPABASE_SERVICE_ROLE_KEY=<nuova service_role key>
```

> `.env.local` non è committato ed è owner-gestito: i secret li incolli tu
> ([`.claude/rules/host-machine-safety.md`](../../.claude/rules/host-machine-safety.md)).

## 15.6 Configura l'Auth nella dashboard nuova

Il login è **magic-link via email** (vedi [capitolo 6](06-autenticazione.md)),
quindi questo passo è **obbligatorio** o gli utenti non ricevono il link.

- **Authentication → URL Configuration**
  - *Site URL*: l'URL di produzione.
  - *Redirect URLs*: aggiungi `http://localhost:3000/**` e
    `https://<tuo-dominio>/**` — rispecchia `additional_redirect_urls` in
    [`supabase/config.toml`](../../supabase/config.toml).
- **Authentication → Emails → SMTP**: riconfigura l'SMTP (es. Gmail). Senza SMTP
  custom i magic-link finiscono nel rate-limit severo del sender di default.
- **Email templates**: se li hai personalizzati sono in
  [`supabase/templates/`](../../supabase/templates) — riallineali nella
  dashboard.

## 15.7 (Opzionale) Migra i dati esistenti

Solo se ti servono i dati del progetto vecchio. Lo schema l'hai già creato al
punto 15.4, quindi si copiano **solo i dati**:

```bash
pg_dump --data-only --no-owner "<CONNECTION_STRING_VECCHIO>" > data.sql
psql "<CONNECTION_STRING_NUOVO>" < data.sql
```

L'ordine di inserimento deve rispettare le foreign key (in alternativa
`--disable-triggers`).

## 15.8 Verifica in locale

```bash
pnpm dev                  # login → arriva il magic-link? entri?
pnpm test                 # unit/component verdi
pnpm exec eslint src/
```

Smoke test manuale: login → crea progetto → crea proposta. Se il login funziona,
allora auth, RLS ed env sono a posto insieme.

## 15.9 Produzione (Vercel) — owner-only

> **I deploy sono owner-only.** Le stesse tre variabili Supabase su Vercel
> (*Project → Settings → Environment Variables*) e redeploy. Il rilascio lo fa
> **Riccardo**
> ([`.claude/rules/change-control.md`](../../.claude/rules/change-control.md)); il
> dettaglio completo delle var di produzione è nel [capitolo 12](12-deploy.md).

## 15.10 I tre punti dove ci si fa male

1. **SMTP dimenticato** (15.6) → i magic-link non arrivano o vanno subito in
   rate-limit. È lo step più facile da saltare.
2. **Redirect URL non allineati** (15.6) → il login parte ma il callback torna
   errore. Devono combaciare con `config.toml`.
3. **`db push` a metà** (15.4) → schema inconsistente. Parti da progetto vuoto e
   guarda l'output fino all'ultima migration.

**Stima:** ~mezza giornata, e il grosso è configurazione in dashboard (SMTP +
redirect OAuth), non codice. Zero righe applicative modificate.

---

Precedente: [← 14. Design language](14-design-language.md) · [Torna all'indice](README.md)
