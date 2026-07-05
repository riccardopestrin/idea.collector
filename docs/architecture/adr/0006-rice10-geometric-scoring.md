# ADR-0006: Scoring RICE-10 — scale 1–10 a rubriche, media geometrica

- **Stato:** Proposed
- **Data:** 2026-07-05

## Context

Lo scoring usa le scale del RICE classico, disomogenee e arbitrarie: Reach illimitato (0 → milioni), Impact 0.25–3 senza unità, Confidence percentuale senza riferimento, Effort stima empirica. L'implementazione compensa con una normalizzazione a [0,1] su due path (scale native per l'AI, slider 1–10 per gli utenti) e due midpoint arbitrari (`RICE_REACH_MIDPOINT`, `RICE_EFFORT_MIDPOINT`); coesistono due metodi (`rice` | `ice`). Il prodotto normalizzato schiaccia i punteggi verso il basso. Cambia la semantica del punteggio su cui si ordinano le proposte → richiede una ADR. Scoping completo e opzioni scartate (ICE puro, WSJF, BRICE, PIE, PXL, weighted scoring) in [RFC-005](../rfc/RFC-005-rice10-scoring-rework.md).

## Decision

Adottare **RICE-10** come metodo di scoring unico, sostituendo sia `rice` che `ice`.

- **4 fattori interi 1–10, stessa scala per AI e utenti**, ancorati a rubriche aziendali: **Reach** = cluster di % utenti attivi (10 = 100%, 1 = interno/admin); **Impact** = spostamento KPI (10 = rivoluzionario, 1 = cosmetico); **Confidence** = livello di evidenza alla Gilad (10 = dati quantitativi + prototipi testati, 1 = puro istinto); **Ease** = Effort invertito a bracket di tempo (10 = <1 giorno, 1 = un trimestre+). Rubriche complete in RFC-005.
- **Punteggio individuale: media geometrica** `score = (R · I · C · E)^(1/4)` ∈ [1, 10] — un fattore debole affossa il totale (non compensativa come la media aritmetica), ma la scala resta leggibile 1–10 (a differenza del prodotto).
- **Composito:** media aritmetica degli score individuali (Claude + ogni votante), invariata nella struttura.
- **Dati esistenti azzerati e rivalutati** (dati di sviluppo): wipe `rice_votes`, reset score AI, ri-valutazione delle proposte in valutazione. I vecchi score AI su scale native non sono convertibili aritmeticamente; l'inversione Effort→Ease rende i vecchi voti incompatibili.

## Consequences

**Positive:** scala finale leggibile 1–10 identica per AI e utenti; spariscono i midpoint arbitrari e il doppio path di normalizzazione (meno codice); le rubriche riducono clustering e "guessing" documentati per gli scoring 1–10 non ancorati; un'idea senza evidenze (Confidence 1) scende in classifica anche se facilissima.
**Negative:** le rubriche sono una convenzione di casa da ritarare quando le metriche del progetto cambiano; si perdono voti e score esistenti (accettato); serve una migrazione owner-locked (wipe + `reach not null` + deprecazione `method`); gli score storici pre-rework non sono confrontabili coi nuovi.

## Source

Critica delle scale RICE dell'owner (2026-07-05) e ricerca di mercato in [RFC-005](../rfc/RFC-005-rice10-scoring-rework.md). Fonti chiave: [Intercom RICE](https://www.intercom.com/blog/rice-simple-prioritization-for-product-managers/), [Confidence Meter di Gilad](https://itamargilad.com/the-tool-that-will-help-you-choose-better-product-ideas/), [EA Forum sulla media geometrica](https://forum.effectivealtruism.org/posts/86PYvFEJoZq8g87gk/weighted-factor-models-consider-using-the-geometric-mean).

## If we were starting today

Sì: partiremmo direttamente da RICE-10 — le scale native di Intercom hanno senso solo con un funnel di conversione unico da misurare, non per proposte eterogenee votate da un team. Con più dati storici, l'unica evoluzione plausibile è ritarare gli ancoraggi delle rubriche, non cambiare formula.
