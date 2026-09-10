# idea.collector

Strumento per raccogliere e discutere idee di prodotto di un
team: ogni idea entra come *proposta*, viene discussa con commenti relativi al
testo e valutata con un punteggio **RICE-10** (membri + AI). Può avanzare su una board a
colonne. Ogni progetto è una bacheca a sé, con membri e ruoli legati al profilo utente.

Stack: **Next.js 16** · **Supabase** (Postgres + Auth + RLS) · **Anthropic
(Claude)** per valutazione/scan · **GitHub App** per il contesto repo.

## 📖 Documentazione

La guida completa, in capitoli, è in **[`docs/guide/`](docs/guide/README.md)** —
leggila da lì. In breve:

- [Introduzione](docs/guide/01-introduzione.md) · [Concetti](docs/guide/02-concetti.md)
- **[Avvio in locale](docs/guide/03-avvio-locale.md)** — la guida passo-passo
- [Architettura](docs/guide/04-architettura.md) · [Modello dati](docs/guide/05-modello-dati.md) · [Autenticazione](docs/guide/06-autenticazione.md)
- [Proposte e board](docs/guide/07-proposte-e-board.md) · [Scoring RICE-10](docs/guide/08-scoring-rice10.md) · [AI e integrazioni](docs/guide/09-ai-integrazioni.md) · [Editor e commenti](docs/guide/10-editor-commenti.md)
- [Testing](docs/guide/11-testing.md) · [Deploy](docs/guide/12-deploy.md) · [Contribuire](docs/guide/13-contribuire.md) · [Design language](docs/guide/14-design-language.md)

Riferimento: [ADR](docs/architecture/adr/README.md) · [RFC](docs/architecture/rfc/) · [Sicurezza](docs/security/README.md) · [Regole del repo](.claude/rules/)

## Avvio rapido

Prerequisiti: Node ≥ 20, `pnpm` ≥ 9, Docker Desktop acceso. Tutti i comandi dalla
radice del repo (niente sottocartella `web/`).

```bash
pnpm install
pnpm db:start                    # stack Supabase locale (Docker)
pnpm exec supabase db reset      # applica tutte le migration
cp .env.example .env.local       # poi riempi con i valori di `supabase status`
pnpm dev                         # http://localhost:3000
```

Senza chiave Anthropic, imposta `AI_EVAL_FAKE=1` e `AI_SCAN_FAKE=1` per la demo.
Dettagli completi (env, primo utente, inviti, Mailpit) in
**[docs/guide/03-avvio-locale.md](docs/guide/03-avvio-locale.md)**.

## Comandi utili

```bash
pnpm dev                         # dev server
pnpm build                       # build di produzione
pnpm test                        # unit + component (Vitest)
pnpm exec eslint src/            # lint
pnpm exec supabase test db       # test RLS (pgTAP)
pnpm test:integration            # scenario full-stack su RLS/RPC reali
pnpm db:start / pnpm db:stop     # stack Supabase locale
pnpm exec supabase db reset      # ricrea il DB dalle migration
```

## Database remoto & deploy

Il progetto remoto Supabase sul free tier viene **messo in pausa dopo ~7 giorni
di inattività**; riattivalo dalla Dashboard (Project → Restore) e applica le
migration con `pnpm exec supabase db push`. I deploy sono **owner-only**. Guida
completa: [docs/guide/12-deploy.md](docs/guide/12-deploy.md).
