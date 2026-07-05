# RFC-005 — Rework dello scoring: RICE-10 (scale omogenee 1-10, media geometrica)

**Stato:** proposta — decisione tecnica fissata in [ADR-0006](../adr/0006-rice10-geometric-scoring.md) (Proposed).
**Data:** 2026-07-05
**Autore:** Riccardo (con Claude)

## Context

Lo scoring attuale usa le scale del RICE classico di Intercom, che sono disomogenee e arbitrarie:

- **Reach** è un numero speculativo e illimitato: può valere 0 o milioni — 6 ordini di grandezza. Un errore di stima di un ordine di grandezza distorce tutta la classifica.
- **Impact** usa la scala Intercom 0.25–3 (massive/high/medium/low/minimal), senza unità: "1–3 cosa?". Lo stesso post originale di Intercom ammette che la scelta del numero "may seem unscientific".
- **Confidence** è una percentuale senza riferimento: fiducia rispetto a che cosa?
- **Effort** (person-months) è l'unico fattore quasi-analitico, ma resta una stima empirica.

L'implementazione attuale compensa la disomogeneità normalizzando ogni componente in [0,1] con due path distinti ([`src/lib/proposals.ts:106-233`](../../../src/lib/proposals.ts)):

- **Claude (AI)** vota con le scale native RICE; la normalizzazione usa due midpoint arbitrari (`RICE_REACH_MIDPOINT = 100`, `RICE_EFFORT_MIDPOINT = 3`) e la mappa lineare `(impact − 0.25) / 2.75`. Prompt e clamp in [`src/lib/ai/evaluateProposal.ts`](../../../src/lib/ai/evaluateProposal.ts).
- **Gli utenti** votano già con slider 1–10 ([`RiceVoteForm.tsx`](../../../src/components/detail/RiceVoteForm.tsx), [`vote.ts`](../../../src/lib/validation/vote.ts), migration `0015_rice_votes.sql`), normalizzati con `(v − 1) / 9`.
- Il punteggio individuale è un prodotto `10 · reach · impact · confidence · (1 − effort)` (RICE) o `10 · impact · confidence · ease` (ICE); il composito è la media dei prodotti (Claude + ogni votante).

Problemi: i midpoint sono manopole arbitrarie quanto le scale che correggono; AI e utenti votano su scale diverse (stessa proposta, due semantiche); il prodotto di componenti normalizzati schiaccia i punteggi verso il basso (quattro "5" su slider → ≈ 0,6/10); coesistono due metodi (`rice` | `ice`) con doppio path di codice e doppia spiegazione al team.

Obiettivo del rework: **ogni fattore su scala 1–10 ancorata a rubriche aziendali oggettive, identica per AI e utenti**, con un punteggio finale leggibile 1–10.

## Ricerca (luglio 2026) — opzioni valutate

### RICE con scale 1–10 a rubriche

Variante consolidata ma **senza nome canonico**: più guide correnti documentano fianco a fianco la scala 0.25–3 e la variante "tutti i fattori 1–10 a bucket etichettati", con conversione fra le due ([ProductLift](https://www.productlift.dev/blog/rice-prioritization/), [SaaS Funnel Lab](https://www.saasfunnellab.com/essay/rice-scoring-prioritization-framework/)). Quando Reach non è misurabile con precisione, la raccomandazione è proprio il bucketing su livelli 1–10 ([StoriesOnBoard](https://docs.storiesonboard.com/en/articles/6454762-rice-prioritization-framework)); i cluster in % di utenti attivi sono di fatto una compressione logaritmica — documentata dai practitioner ma informale. Le critiche note del RICE coincidono con le nostre: distorsione da Reach ([Product Teacher](https://www.productteacher.com/articles/product-manager-guide-to-rice-prioritization)), degradazione con metriche eterogenee ([Product School](https://productschool.com/blog/product-fundamentals/rice-framework)).

### Confidence Meter di Itamar Gilad

L'unica rubrica di confidence evidence-based ampiamente citata: mappa il **tipo di evidenza** a un punteggio ([Gilad](https://itamargilad.com/the-tool-that-will-help-you-choose-better-product-ideas/), [Votito](https://www.votito.com/methods/confidence-meter/), [Thiga](https://www.media.thiga.co/en/en/advanced-ice-using-the-confidence-meter-itamar-gilad)). Sulla sua scala 0.01–10: convinzione personale ≈ 0.01, opinioni di esperti ≈ 0.1–0.2, stime e business case ≈ 0.4–0.5, evidenza aneddotica ≈ 0.5–1, dati di mercato ≈ 1–3, interviste/MVP ≈ 3, A/B test ≈ 4–5, dati di produzione = 10. Proprietà chiave: le opinioni non superano ~0.2, così un'idea sostenuta solo da convinzione viene schiacciata dalla moltiplicazione — deliberatamente. Si ri-ancora in modo pulito a 1–10.

### ICE puro (Sean Ellis / Gilad) — scartato

Gilad sostiene che "Reach è semplicemente una componente di Impact" e usa ICE a 3 fattori 1–10, moltiplicati ([itamargilad.com/ice-scores](https://itamargilad.com/ice-scores/)). Più semplice, ma perde il segnale esplicito di portata — che nel nostro caso l'AI stima bene avendo il contesto del repository. Failure mode documentati di ICE senza rubriche: clustering sui valori centrali 5-6 e "guessing dressed as scoring"; il fix accettato è proprio l'ancoraggio a rubriche ([Eppo](https://www.geteppo.com/blog/ice-scoring-method), [Fibery](https://fibery.com/blog/product-management/ice/), [Savio](https://www.savio.io/product-roadmap/ice-scoring-model/)).

### WSJF (SAFe) — scartato

`Cost of Delay / Job Size`, tutti gli input su Fibonacci modificato (1,2,3,5,8,13,20) valutati **relativamente agli altri item del batch** ([Scaled Agile](https://framework.scaledagile.com/wsjf)). Risolve l'illimitatezza per costruzione, ma i punteggi non sono stabili nel tempo: vanno ri-assegnati quando il backlog cambia — pessimo per un tool dove i voti sono persistenti e immutabili. Noti anche gaming da slicing e bias da singolo stakeholder ([RoadmapOne](https://roadmap.one/blog/posts/blog8-4-wsjf-prioritisation/), [ProductPlan](https://www.productplan.com/glossary/weighted-shortest-job-first)).

### Altri

- **BRICE**: `Business importance × R × I × C / E` con moltiplicatore strategico 1–3 ([Kaplan](https://medium.com/swlh/use-brice-not-rice-scoring-for-product-prioritization-8e2fa3546748)). Non risolve il problema delle scale; mostra però che il pattern "moltiplicatore aggiuntivo" è accettato, se un domani servisse l'allineamento strategico.
- **PIE**: media di Potential/Importance/Ease 1–10 ([Growth Method](https://growthmethod.com/pie-framework/)) — stessa soggettività che abbiamo oggi; la media aritmetica è la sua debolezza documentata.
- **PXL (CXL)**: ~10 domande binarie oggettive + Ease a bracket di tempo ([CXL](https://cxl.com/blog/better-way-prioritize-ab-tests/)). Lezione trasversale adottata: "gli ingegneri sanno stimare ore, nessuno sa stimare un numero su una scala arbitraria" — dove una rubrica può essere un sì/no oggettivo o un bracket di tempo, meglio.
- **Opportunity Scoring (Ulwick/ODI)**: `Importance + max(Importance − Satisfaction, 0)` da survey ([ProductPlan](https://www.productplan.com/glossary/opportunity-scoring)) — misura il bisogno insoddisfatto, non il costo di delivery; complementa, non sostituisce.
- **Weighted scoring**: `Σ (score × peso)` ([Product School](https://productschool.com/blog/product-fundamentals/weighted-scoring-model)) — utile se i fattori avessero importanza diversa; oggi non serve (pesi uguali), vulnerabile al weight-gaming a posteriori.
- **AI-assisted (2025-2026)**: nessun framework canonico nuovo; la pratica è "LLM pre-valuta contro una rubrica esistente, gli umani rivedono" — le rubriche strutturate rendono gli score LLM più riproducibili ([aqua cloud](https://aqua-cloud.io/ai-requirements-prioritisation/), [Articos](https://www.articos.com/blog/ai-feature-prioritization)). Esattamente il nostro assetto (Claude + voti utente sulla stessa rubrica).

### Aggregazione: media aritmetica vs prodotto vs media geometrica

Il trattamento più solido trovato è dell'[EA Forum](https://forum.effectivealtruism.org/posts/86PYvFEJoZq8g87gk/weighted-factor-models-consider-using-the-geometric-mean): la **media aritmetica è compensativa** — un fattore forte salva un fattore fatale (Confidence=1 + Ease=10 galleggia comunque a metà classifica), sbagliato per modelli di impatto che sono moltiplicativi per natura. Il **prodotto puro** punisce correttamente ma produce range illeggibili (1–10.000 su quattro fattori 1–10) o, normalizzato, schiaccia tutto verso il basso (il nostro problema attuale). La **media geometrica** `(R·I·C·E)^(1/4)` punisce i fattori deboli come il prodotto **e** resta sulla scala 1–10. Coerente con Gilad, che raccomanda la moltiplicazione proprio perché la confidence bassa affossi il totale. Unico caveat: non gestisce lo zero — irrilevante col floor a 1.

Esempio numerico (perché geometrica e non aritmetica): R=8, I=7, C=3, E=8 → aritmetica 6,5; geometrica `(8·7·3·8)^(1/4)` ≈ **6,1**… e con C=1 → aritmetica 6,0 (quasi invariata!), geometrica ≈ **4,6**. La scommessa senza evidenze scende in classifica, come deve.

## Decisione

**RICE-10**: metodo unico che sostituisce sia `rice` che `ice`.

- 4 fattori **interi 1–10** ancorati alle rubriche sotto: **Reach, Impact, Confidence, Ease** (Effort invertito: 10 = facile).
- Stessa scala e stesse rubriche per la valutazione AI e per i voti utente.
- Punteggio individuale: **media geometrica** `score = (R · I · C · E)^(1/4)` ∈ [1, 10].
- Punteggio composito: media aritmetica degli score individuali (Claude + ogni votante), come oggi; medie per componente invariate nella struttura.
- Dati esistenti azzerati e rivalutati (sono dati di sviluppo): wipe di `rice_votes`, reset degli score AI, ri-valutazione delle proposte in valutazione.

## Le 4 rubriche

Convenzione di casa (non standard di settore), da ritarare quando le metriche del progetto cambiano. I valori intermedi (3, 6, 9…) interpolano tra gli ancoraggi.

### Reach — % di utenti attivi impattati (cluster ~logaritmici)

| Voto | Ancoraggio |
|---|---|
| 10 | 100% degli utenti attivi (es. redesign homepage/login) |
| 8 | Maggioranza degli utenti (>50%) |
| 5 | Feature specifica o nicchia importante (~20–30%) |
| 2 | Percentuale minima (<5%) |
| 1 | Uso interno / admin |

### Impact — spostamento dei KPI

| Voto | Ancoraggio |
|---|---|
| 10 | Rivoluzionario: cambia radicalmente il business (es. raddoppia la conversione) |
| 7–8 | Alto: miglioramento netto e misurabile su un KPI principale (es. +10% retention) |
| 4–6 | Medio: ottimizzazione utile, incremento marginale delle performance |
| 2–3 | Basso: piccola miglioria UX, quasi impercettibile nei macro-dati |
| 1 | Minimo: fix puramente cosmetico |

### Confidence — livello di evidenza (Confidence Meter di Gilad, ri-ancorato 1–10)

| Voto | Ancoraggio |
|---|---|
| 10 | Dati quantitativi storici, prototipi testati, interviste utenti — rischio quasi zero |
| 7–8 | Forte richiesta degli utenti e dati di mercato chiari, soluzione non ancora testata |
| 5 | Idea supportata da intuizioni di esperti, dati frammentari |
| 2–3 | Scommessa basata su feedback isolati |
| 1 | Puro istinto (zero dati) |

### Ease — bracket di tempo (Effort invertito)

| Voto | Ancoraggio |
|---|---|
| 10 | Meno di un giorno di lavoro |
| 8 | Pochi giorni / 1 sprint di un solo dev |
| 5 | 1–2 sprint di un team cross-funzionale |
| 2 | Progetto di diversi mesi / alta complessità architetturale |
| 1 | Epica che blocca il team per un trimestre o più |

## Fasi di implementazione (dopo l'accettazione dell'ADR-0006 — non in questa PR)

### Fase A — Formula (`src/lib/proposals.ts` + test)

- Eliminare `normalizeClaude`, i midpoint `RICE_REACH_MIDPOINT`/`RICE_EFFORT_MIDPOINT` e il doppio path: un'unica normalizzazione (tutti i rater votano 1–10).
- `productScore` → media geometrica `(r·i·c·e)^(1/4)`; niente più `(1 − effort)`: il campo è Ease, già positivo.
- `computeCompositeScore`/`computeVoteScore`/`computeClaudeScore`/`rankProposalsByScore` invariati nella struttura; componenti medi direttamente su scala 1–10 (senza ×10).
- Aggiornare `proposals.test.ts` (inclusi i casi: C=1 affossa lo score; quattro 5 → 5).

### Fase B — AI (`src/lib/ai/evaluateProposal.ts` + test)

- System prompt: le 4 rubriche sopra (testo unico, niente più branching rice/ice); output 1–10 per tutti i fattori.
- `validateScores`: clamp uniforme 1–10 (+ arrotondamento a intero), un solo path.
- `manually_edited` / eventuale editing admin degli score segue la stessa scala.

### Fase C — Migrazione (OWNER-LOCKED, `supabase/migrations/`)

- Wipe `rice_votes`; reset colonne score (`reach/impact/confidence/effort`), `ai_rationale`, `ai_eval_status → 'assente'` su `proposals`.
- `rice_votes.reach` → `not null` (check 1–10 su tutti i componenti).
- Deprecazione della colonna/enum `method` su `proposals` (nessuna scelta del metodo alla creazione).
- Richiede review e apply di Riccardo ([`change-control.md`](../../../.claude/rules/change-control.md)).

### Fase D — UI

- `RiceVoteForm.tsx`: label "Ease" (10 = facile), slider Reach sempre presente, tooltip/legenda con le rubriche.
- `ProposalPanel.tsx` / `ProposalCard.tsx`: componenti su scala 1–10, via le etichette condizionali rice/ice.
- Rimozione del picker del metodo alla creazione proposta; `vote.ts`: reach sempre richiesto.
- Rilanciare la valutazione AI sulle proposte `in_valutazione`.

Ordine: A e B indipendenti; C dopo A+B (il codice nuovo deve essere deployato prima del reset); D dopo A.

## Rischi / Conseguenze

- **Perdita dei voti esistenti** (accettata: dati di sviluppo). L'inversione Effort→Ease rende comunque i vecchi voti semanticamente incompatibili.
- **Le rubriche sono una convenzione di casa**: i cluster di Reach dipendono dalle metriche attuali del progetto e vanno ritarati se la base utenti cambia natura.
- **La media geometrica non gestisce lo 0**: floor a 1 garantito dai check DB e dal clamp di validazione.
- **Score AI esistenti non convertibili** (scale native → rubriche richiede giudizio, non aritmetica): la ri-valutazione è l'unica via onesta.
- Il punteggio composito resta una media di medie geometriche — leggibile 1–10, ma non confrontabile con gli score storici pre-rework (accettato: si riparte da zero).
