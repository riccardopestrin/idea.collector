# 12. Deploy

> **I deploy sono owner-only.** Solo Riccardo rilascia, in qualsiasi ambiente.
> Tutti gli altri preparano e passano la mano
> ([`.claude/rules/change-control.md`](../../.claude/rules/change-control.md)).
> Questo capitolo documenta *come* è fatto il rilascio, non autorizza a farlo.

L'app gira su **Vercel** (Next.js) con **Supabase** come backend remoto.

## 12.1 Il backend Supabase remoto

Il progetto remoto è già linkato (`supabase/.temp/project-ref`).

- **Free tier**: viene **messo in pausa dopo ~7 giorni di inattività**. Sintomo:
  `supabase migration list --linked` fallisce con *"Connection terminated due to
  connection timeout"*. Rimedio: controlla lo stato con
  `pnpm exec supabase projects list` e riattivalo dalla Dashboard (Project →
  Restore).
- **Applicare le migration** al remoto:

  ```bash
  pnpm exec supabase db push
  ```

  Ricorda: `supabase/migrations/` è owner-locked; il push al remoto è parte del
  rilascio (owner).

> Per spostare l'app su **un altro progetto/account Supabase** (fork o nuovo
> tenant) segui il [capitolo 15 — Runbook cambio account Supabase](15-runbook-cambio-account-supabase.md).

## 12.2 Variabili d'ambiente di produzione

Su Vercel (Project → Settings → Environment Variables) vanno gli stessi nomi di
[`.env.example`](../../.env.example), con i valori del **progetto remoto**
(Supabase Dashboard → Settings → API):

| Variabile | Note produzione |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Dal progetto remoto. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only. Necessaria per inviti/AI. **Mai in una var `NEXT_PUBLIC_`.** |
| `ANTHROPIC_API_KEY` | Per valutazione/scan reali. Senza, l'app resta funzionante ma serve `AI_EVAL_FAKE`/`AI_SCAN_FAKE`. |
| `AI_EVAL_FAKE` / `AI_SCAN_FAKE` | In produzione tenerli a `0`/assenti una volta che la key Anthropic è operativa. |
| `GITHUB_APP_ID` / `GITHUB_APP_SLUG` / `GITHUB_APP_PRIVATE_KEY` | Solo se si usa il contesto repo. Private key su una riga con `\n`. |

## 12.3 Email transazionali (magic link + inviti)

- Serve un **SMTP** configurato su Supabase (Dashboard → Authentication → SMTP
  Settings) perché in produzione le email partano davvero (in locale è Mailpit).
- Il **template dell'invito va replicato a mano** sul progetto remoto: Dashboard
  → Authentication → Email Templates → *Invite user*, usando lo stesso link di
  [`supabase/templates/invite.html`](../../supabase/templates/invite.html), che
  punta a `/auth/callback?token_hash=…&type=invite`. Lo stesso per *Change email*
  ([`email_change.html`](../../supabase/templates/email_change.html)).
- Verifica che gli **URL di redirect** (Site URL e Redirect URLs) su Supabase
  includano il dominio di produzione, altrimenti magic link e inviti falliscono.

## 12.4 Checklist di rilascio

1. `pnpm test` e `pnpm exec eslint src/` verdi ([capitolo 11](11-testing.md)).
2. Se ci sono nuove migration: progetto remoto attivo → `pnpm exec supabase db push`.
3. Variabili d'ambiente Vercel allineate (§12.2), service-role server-only.
4. SMTP attivo e template invito/cambio-email replicati sul remoto (§12.3).
5. Site URL / Redirect URLs Supabase includono il dominio di produzione.
6. Deploy su Vercel (owner).
7. Fumo post-deploy: login via magic link, creazione progetto, nuova proposta →
   parte lo scan, valutazione AI (o stub) → punteggio visibile.

## 12.5 Note operative

- Se il DB remoto è in pausa da inattività, **riattivalo prima** di deploy o test
  che lo toccano (§12.1).
- La GitHub App e la key Anthropic sono opzionali per far *girare* l'app, ma
  necessarie per le rispettive feature reali.

## 12.6 Latenza: regione e round trip

Ogni navigazione è un render server-side (le pagine leggono i cookie, quindi
sono dinamiche: niente cache) che parla con Supabase. In produzione il costo di
una pagina è **il numero di round trip sequenziali verso Supabase × la latenza
tra la function Vercel e il database**. In locale non si vede nulla (Docker
risponde in ~1 ms); in produzione un round trip transatlantico costa ~100 ms.

Due regole, entrambe già applicate:

1. **Regione Vercel = regione Supabase.** Vercel → Settings → Functions →
   *Function Region*, stessa regione del progetto Supabase (Settings → General).
   Il default Vercel è `iad1` (Washington): con un DB europeo ogni hop paga
   l'oceano. È un'impostazione del dashboard, non del repo.
2. **Un solo hop di dati per pagina.** Il proxy verifica il JWT in locale con
   `getClaims()` ([§6.3](06-autenticazione.md#63-il-proxy-refresh-della-sessione--gate)),
   le pagine leggono l'identità dalle claims (`currentUser()`) e le query
   indipendenti partono in parallelo (`Promise.all`; es. board e classifica
   lanciano `listProposals` insieme a `loadProject`). Prima erano quattro hop
   sequenziali (`getUser` nel proxy, `getUser` in pagina, contesto progetto,
   proposte): ora uno.

Cosa **non** fare: cache server-side dei dati. Sono per utente (RLS) e cambiano
live (`RealtimeRefresh` fa `router.refresh()` a ogni evento Postgres): una cache
sopra aggiungerebbe staleness da invalidare senza guadagno, dato che l'unico hop
rimasto nella stessa regione costa pochi millisecondi. Se dopo il deploy resta
una lentezza percepita, il passo successivo è un `loading.tsx` per route
(feedback immediato + prefetch dello shell), non una cache.

---

Precedente: [← 11. Testing](11-testing.md) · Prossimo: [13. Contribuire →](13-contribuire.md)
