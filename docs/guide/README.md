# La guida di idea.collector

Benvenuto. Questa è la guida completa di **idea.collector**:
una serie di capitoli brevi e sequenziali che partono dai concetti base e arrivano al
deploy passando per il design e il codice. Viene ulteriormente spiegato come si può contribuire.

Ogni capitolo è un documento a sé. I riferimenti al codice sono link cliccabili.

## Indice

1. [Introduzione](01-introduzione.md) — cos'è idea.collector, a chi serve, la filosofia del progetto.
2. [Concetti e glossario](02-concetti.md) — proposta, board, stato, progetto, ruolo, RICE-10, contributo, scan. Il vocabolario che ricorre ovunque.
3. [Avvio in locale](03-avvio-locale.md) — dai prerequisiti al primo `pnpm dev` con lo stack Supabase in Docker. La guida passo-passo.
4. [Architettura](04-architettura.md) — lo stack, l'architettura a livelli, la mappa del repository, dove va ogni concern.
5. [Modello dati](05-modello-dati.md) — tabelle, enum, RLS, RPC e la storia delle migration.
6. [Autenticazione e sessioni](06-autenticazione.md) — magic link, inviti, il `proxy`, l'onboarding, GitHub OAuth.
7. [Proposte e board](07-proposte-e-board.md) — il ciclo di vita di una proposta, la macchina a stati, board e classifica.
8. [Scoring RICE-10](08-scoring-rice10.md) — le rubriche 1–10, la media geometrica, i voti dei membri e il voto dell'AI.
9. [AI e integrazioni](09-ai-integrazioni.md) — valutazione AI, scan anti-duplicato/competitor, GitHub, ClickUp, gli stub FAKE.
10. [Editor e commenti](10-editor-commenti.md) — Tiptap, storage markdown, ancoraggio dei commenti, promozione a contributo.
11. [Testing](11-testing.md) — unit, component, integrazione e pgTAP: cosa lanciare e cosa deve essere verde.
12. [Deploy](12-deploy.md) — Vercel + Supabase remoto, variabili di produzione, template email, checklist di rilascio.
13. [Contribuire](13-contribuire.md) — il workflow, le regole `.claude/rules`, la review chain, change-control, ADR/RFC.
14. [Design language](14-design-language.md) — palette, tipografia, componenti e i principi brutalisti della UI.

## Runbook operativi

Procedure una tantum, fuori dal filo narrativo dei capitoli sopra.

15. [Runbook — cambiare account Supabase](15-runbook-cambio-account-supabase.md) — fork o nuovo progetto Supabase: env, migration, config auth. Indolore, ~mezza giornata.

## Documentazione di riferimento (fuori da questa guida)

Questa guida racconta *come funziona* e *come lavorarci*. Le decisioni vincolanti
e i registri operativi vivono altrove e restano la fonte di verità:

- [`docs/architecture/adr/`](../architecture/adr/README.md) — Architecture Decision Records: le decisioni prese e perché.
- [`docs/architecture/rfc/`](../architecture/rfc/) — le proposte di design (RFC) da cui nascono le ADR.
- [`docs/security/`](../security/README.md) — classi di vulnerabilità, finding aperti, issue note e deferite.
- [`docs/roadmap/accessibility.md`](../roadmap/accessibility.md) — il registro degli issue di accessibilità.
- [`.claude/rules/`](../../.claude/rules/) — le regole che agenti e umani seguono lavorando in questo repo.

---

Prossimo: [1. Introduzione →](01-introduzione.md)
