# 6. Autenticazione e sessioni

L'auth è tutta transport ([capitolo 4](04-architettura.md)): risolve *chi* è la
richiesta. *Cosa* può fare lo decidono service + RLS ([capitolo 5](05-modello-dati.md)).

## 6.1 Accesso solo su invito

Non esiste registrazione aperta. La pagina di login
([`src/app/login/page.tsx`](../../src/app/login/page.tsx)) usa un **magic link**
passwordless:

```ts
signInWithOtp({ email, shouldCreateUser: false, emailRedirectTo: origin + "/auth/callback" })
```

`shouldCreateUser: false` (più i signup disabilitati su Supabase) significa che
un'email sconosciuta non crea un utente: si entra solo se già invitati.

## 6.2 Il callback di sessione

[`src/app/auth/callback/route.ts`](../../src/app/auth/callback/route.ts) è un
Route Handler (può scrivere i cookie) e gestisce due casi:

- `?code=…` → `exchangeCodeForSession` (magic link di login).
- `?token_hash=…&type=invite|email_change` → `verifyOtp` (invito admin o cambio
  email; i template stanno in [`supabase/templates/`](../../supabase/templates/)).

Successo → redirect a `/`. Fallimento → `/login`.

## 6.3 Il `proxy` (refresh della sessione + gate)

[`src/proxy.ts`](../../src/proxy.ts) è l'ex-middleware (convenzione Next 16). Con
`createServerClient` chiama `getUser()`, che **valida il token e fa il refresh dei
cookie di sessione**. Serve perché i Server Component non possono riscrivere i
cookie: lo fa il proxy, una volta per richiesta.

Regole del gate:

- Rotte pubbliche: `/login` e `/auth/callback`.
- Non autenticato su rotta protetta → redirect `/login`.
- Autenticato su `/login` → redirect `/`.
- Il `matcher` esclude asset statici e `icon.svg`.

Il proxy fa **solo** questo: nessuna regola di business, nessuna autorizzazione.

## 6.4 Onboarding

Dopo il primo accesso, se `profiles.name` è ancora NULL l'utente viene mandato a
[`/onboarding`](../../src/app/onboarding/page.tsx) per impostare il nome, poi
torna a `/`. La home ([`src/app/page.tsx`](../../src/app/page.tsx)) applica lo
stesso redirect difensivo.

## 6.5 Inviti

L'admin di un progetto invita da **Profilo → Utenti**. La Server Action
`inviteMember` ([`src/app/projects/actions.ts`](../../src/app/projects/actions.ts))
usa `auth.admin.inviteUserByEmail` **col client service-role** (l'API admin
richiede la service key, lato server). L'email usa il template
[`supabase/templates/invite.html`](../../supabase/templates/invite.html) e manda a
`/auth/callback?token_hash=…&type=invite` (verifica server-side).

- **In locale**: le email finiscono su Mailpit (`http://127.0.0.1:54324`).
- **In remoto**: il template va replicato a mano nella Dashboard →
  Authentication → Email Templates → Invite user, con lo stesso link. Vedi il
  [capitolo 12](12-deploy.md).

## 6.6 GitHub OAuth (collegamento repo)

[`src/app/auth/github/callback/route.ts`](../../src/app/auth/github/callback/route.ts)
è il callback della GitHub App, non un login. Verifica:

1. **Anti-CSRF**: confronta `state` col nonce+projectId salvato in un cookie
   `github_connect_state` da `startGithubConnect`.
2. Che l'utente sia **admin del progetto**.
3. L'`installation_id`, generando un installation token con la private key.

Se l'installazione copre una sola repo, la seleziona subito; poi redirige alle
impostazioni del progetto. Dettagli dell'integrazione nel
[capitolo 9](09-ai-integrazioni.md).

## 6.7 I tre client Supabase

Da [`src/lib/supabase/`](../../src/lib/supabase/) — usare quello giusto è una
questione di sicurezza:

| Client | File | Quando |
|---|---|---|
| **server** | `server.ts` | Server Component / Server Action. Legge la sessione dai cookie (RLS attive). |
| **browser** | `client.ts` | Client Component (es. login). |
| **admin** | `admin.ts` | **Solo server, mai in un Client Component.** Service-role: bypassa RLS. L'autorizzazione la fa il chiamante *prima*. |

Regola pratica: se stai per usare `supabaseAdmin()`, deve esserci già una guardia
di autorizzazione sopra di te, e la scrittura deve essere qualcosa che l'utente
non deve poter forgiare (esiti AI, gestione utenti, `github_*`).

---

Precedente: [← 5. Modello dati](05-modello-dati.md) · Prossimo: [7. Proposte e board →](07-proposte-e-board.md)
