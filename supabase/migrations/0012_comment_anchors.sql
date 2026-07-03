-- Commenti ancorati a selezioni di testo (RFC-004 Fase D, ADR-0005).
-- Ancora = exact-quote (proiezione plain-text) + occurrence index sul campo.
-- Tutte e tre le colonne o nessuna (commento non ancorato = legacy).
-- La risoluzione avviene a render-time: quote assente nel testo corrente →
-- commento orfano (badge "testo modificato"), nessun re-anchoring.

alter table public.comments
  add column anchor_field text check (anchor_field in ('description', 'problem')),
  add column anchor_text text check (char_length(anchor_text) between 1 and 2000),
  add column anchor_occurrence integer check (anchor_occurrence >= 1),
  add constraint comments_anchor_all_or_none check (
    (anchor_field is null) = (anchor_text is null)
    and (anchor_field is null) = (anchor_occurrence is null));
