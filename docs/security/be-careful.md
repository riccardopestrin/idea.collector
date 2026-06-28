**Last updated:** 2026-06-28

# Be Careful — issue note consapevolmente rinviate

Registro durevole delle NICE-TO-HAVE consapevolmente rinviate: problemi che **non** si verificano nell'attuale use case ma che possono "svegliarsi" se un'assunzione cambia. Vedi [`.claude/rules/nice-to-have-to-be-careful.md`](../../.claude/rules/nice-to-have-to-be-careful.md) per il flusso.

Ogni voce ha un ID stabile nel formato `YYYY-MM-DD-XXXX` (data del flag + 4 char di hash). **Gli ID non vengono mai riusati, rinumerati o riscritti**, nemmeno dopo la risoluzione.

---

## `2026-06-28-pr0x` Il matcher del proxy non esclude `/api`

**Status:** non fissato — non si verifica nell'attuale use case.

### Dove
- [proxy.ts:42-44](../../proxy.ts) — `matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]`

### Il problema potenziale
Il matcher non esclude `/api`. Se in futuro si aggiunge un Route Handler (`src/app/**/route.ts`), una richiesta non autenticata verso quell'endpoint riceve un redirect HTML 307 verso `/login` invece di un 401 JSON — contratto API sbagliato per un consumer programmatico.

### Perché oggi non è un problema
Esiste un solo Route Handler, `src/app/auth/callback/route.ts`, ma è un endpoint di redirect per browser sotto `/auth/callback` (non `/api`) ed è esplicitamente pubblico nel proxy: una GET non autenticata deve passare, e passa. Non esiste ancora nessun endpoint `/api` pensato per client programmatici, quindi il caso "redirect HTML invece di 401 JSON" non si verifica.

### Quando diventa un problema
1. Quando si aggiunge il primo `route.ts` sotto `src/app/api` (o comunque pensato per client non-browser) che, senza sessione, deve rispondere 401/403 JSON invece di un redirect.

### Cosa fare se devi toccare quest'area
Aggiungere `api|` al negative-lookahead, come da doc Next 16 (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`):
```ts
matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"]
```
oppure escludere `/api` e autenticare dentro il handler restituendo un 401 JSON.

### Cronologia
- 2026-06-28 — Flaggato durante review Step 1 (auth OTP). Downgrade a NICE-TO-HAVE perché non esistono Route Handler oggi.
- 2026-06-28 — Revisione: arrivato il primo Route Handler (`/auth/callback`, magic link). Resta benigno perché è un redirect pubblico per browser, non un endpoint `/api`. Trigger aggiornato a "primo endpoint `/api` per client programmatici".

## `2026-06-28-lnk1` Link delle proposte salvati senza validazione URL

**Status:** non fissato — non si verifica nell'attuale use case.

### Dove
- [src/app/proposals/new/actions.ts](../../src/app/proposals/new/actions.ts) — parsing del campo `links`
- colonna `proposals.links` (`text[]`)

### Il problema potenziale
I link inseriti nel form vengono salvati verbatim (split per riga, trim, filter), senza validare schema o host. Diventano input non fidato persistito.

### Perché oggi non è un problema
I link vengono solo salvati: non sono ancora né renderizzati come `<a>` né fetchati. Nessuna superficie d'attacco attiva.

### Quando diventa un problema
1. Quando la valutazione AI (RICE, spec §4.3/§5) scarica il contenuto dei link e lo passa al prompt di Claude → SSRF (fetch verso URL interni/arbitrari) + prompt injection (contenuto malevolo iniettato nel prompt).
2. Quando i link vengono mostrati come `<a href>` cliccabili → rischio `javascript:`/`data:` URI se non sanificati.

### Cosa fare se devi toccare quest'area
Validare lo schema (solo `http`/`https`) e applicare un allow/deny sull'host prima del fetch; sanificare l'href in UI; per il fetch server-side usare timeout e blocco degli IP privati/loopback.

### Cronologia
- 2026-06-28 — Flaggato durante review Step 2 (form nuova proposta). Deferito: campo inerte finché non arriva la feature AI.

---

## Risolti recenti

_Nessuna voce risolta._
