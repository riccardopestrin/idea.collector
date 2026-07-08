-- Promozione commento → contributo dell'idea (branch commentPromotion).
--
-- Un commento può essere candidato dal suo autore ('none' → 'pending'), accettato
-- o rifiutato dal proposer/admin ('pending' → 'accepted' | 'none') e revocato
-- (autore, proposer o admin: 'accepted' → 'none'). Tutto solo con proposta in
-- 'nuova'/'in_valutazione' (da 'approvata' in poi congelato, come la
-- cristallizzazione 0013). Il testo del contributo è live (nessuno snapshot):
-- il body del commento viene reso come paragrafo attribuito sotto la proposta.
--
-- Il voto RICE di un contributore accettato NON viene toccato: la "sospensione"
-- è derivata a lettura in TS (voto escluso dal composito finché il voter ha un
-- commento accepted sulla stessa proposta) — niente colonna, niente race
-- write-skew, reintegro automatico al revoke. Qui si blocca solo il NUOVO voto.
--
-- Le transizioni passano SOLO dalle RPC security definer con CAS (pattern
-- move_proposal, 0006): il grant update sui commenti resta column-level su
-- `body` (0014), quindi promotion_status non è scrivibile via PostgREST.
--
-- Superficie eval (deliberato, come l'header di 0013): can_run_ai_evaluation si
-- allarga anche all'autore di un commento *accepted* (per il re-eval quando
-- modifica il proprio contributo). NON copre il revoke fatto dall'autore: dopo
-- il revoke non è più contributore, quindi il suo revoke non rilancia l'eval
-- (lo score resta stale e proposer/admin usano "Rilancia"). Alternativa scartata
-- — allargare a qualsiasi commentatore — avrebbe permesso di forgiare punteggi
-- AI via PostgREST diretto (apply_ai_evaluation) su ogni proposta in valutazione.

alter table public.comments add column promotion_status text not null default 'none'
  check (promotion_status in ('none', 'pending', 'accepted'));

-- Il grant insert su comments è table-wide: senza questo check un commento
-- potrebbe nascere 'accepted' via PostgREST diretto.
drop policy "author insert on open proposal" on public.comments;
create policy "author insert on open proposal" on public.comments
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and promotion_status = 'none'
    and exists (
      select 1 from public.proposals p
      where p.id = proposal_id and p.status in ('nuova', 'in_valutazione')
    )
  );

-- Un contributo accettato non si elimina: prima il revoke (UI nasconde Elimina).
drop policy "author delete own open" on public.comments;
create policy "author delete own open" on public.comments
  for delete to authenticated
  using (
    author_id = auth.uid()
    and promotion_status <> 'accepted'
    and exists (
      select 1 from public.proposals p
      where p.id = proposal_id and p.status in ('nuova', 'in_valutazione')
    )
  );

-- Un contributore accettato è co-autore: non vota (come il proposer in 0015).
drop policy "voter insert" on public.rice_votes;
create policy "voter insert" on public.rice_votes for insert to authenticated
  with check (
    voter_id = auth.uid()
    and exists (
      select 1 from public.proposals p
      where p.id = proposal_id
        and p.status = 'in_valutazione'
        and p.proposer_id <> auth.uid()
    )
    and not exists (
      select 1 from public.comments c
      where c.proposal_id = rice_votes.proposal_id
        and c.author_id = auth.uid()
        and c.promotion_status = 'accepted'
    )
  );

-- Guard comune delle RPC: commento + proposta aperta. Ritorna la riga o solleva.
-- Nota: il check di stato è check-then-act rispetto a un move_proposal
-- concorrente (stessa finestra già accettata per l'insert dei commenti).
create function public.promotion_target(p_comment_id uuid)
returns public.comments language plpgsql security definer set search_path = '' stable as $$
declare
  c public.comments;
begin
  if auth.uid() is null then
    raise exception 'non autenticato';
  end if;
  select * into c from public.comments where id = p_comment_id;
  if not found then
    raise exception 'commento inesistente';
  end if;
  if not exists (
    select 1 from public.proposals p
    where p.id = c.proposal_id and p.status in ('nuova', 'in_valutazione')
  ) then
    raise exception 'proposta non più aperta: promozione congelata';
  end if;
  return c;
end;
$$;

-- Candidatura: solo l'autore del commento, mai sul commento del proposer della
-- proposta stessa. CAS su 'none' → false se lo stato è cambiato sotto i piedi.
create function public.request_comment_promotion(p_comment_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  c public.comments;
  updated integer;
begin
  c := public.promotion_target(p_comment_id);
  if c.author_id <> auth.uid() then
    raise exception 'solo l''autore del commento può candidarlo';
  end if;
  if exists (
    select 1 from public.proposals p
    where p.id = c.proposal_id and p.proposer_id = c.author_id
  ) then
    raise exception 'i commenti del proposer non sono promuovibili';
  end if;
  update public.comments set promotion_status = 'pending'
    where id = p_comment_id and promotion_status = 'none';
  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;

-- Accetta/rifiuta: proposer o admin. CAS su 'pending' (una delete o re-candidatura
-- concorrente fa fallire il resolve invece di accettare alla cieca).
create function public.resolve_comment_promotion(p_comment_id uuid, p_accept boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  c public.comments;
  updated integer;
begin
  c := public.promotion_target(p_comment_id);
  if not public.is_admin() and not exists (
    select 1 from public.proposals p
    where p.id = c.proposal_id and p.proposer_id = auth.uid()
  ) then
    raise exception 'solo il proposer o un admin decide sulla promozione';
  end if;
  update public.comments
    set promotion_status = case when p_accept then 'accepted' else 'none' end
    where id = p_comment_id and promotion_status = 'pending';
  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;

-- Revoca: autore del contributo, proposer o admin. CAS su 'accepted'.
create function public.revoke_comment_promotion(p_comment_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  c public.comments;
  updated integer;
begin
  c := public.promotion_target(p_comment_id);
  if c.author_id <> auth.uid() and not public.is_admin() and not exists (
    select 1 from public.proposals p
    where p.id = c.proposal_id and p.proposer_id = auth.uid()
  ) then
    raise exception 'solo autore, proposer o admin possono revocare il contributo';
  end if;
  update public.comments set promotion_status = 'none'
    where id = p_comment_id and promotion_status = 'accepted';
  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;

revoke execute on function
  public.promotion_target,
  public.request_comment_promotion,
  public.resolve_comment_promotion,
  public.revoke_comment_promotion
from public, anon;
grant execute on function
  public.request_comment_promotion,
  public.resolve_comment_promotion,
  public.revoke_comment_promotion
to authenticated;

-- [eval] anche l'autore di un contributo accepted può rilanciare l'eval (edit
-- del proprio contributo mentre la proposta è in valutazione).
create or replace function public.can_run_ai_evaluation(p_id uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select public.is_admin()
    or exists (
      select 1 from public.proposals
      where id = p_id and proposer_id = auth.uid() and status = 'in_valutazione'
    )
    or exists (
      select 1 from public.proposals p
      join public.comments c on c.proposal_id = p.id
      where p.id = p_id
        and p.status = 'in_valutazione'
        and c.author_id = auth.uid()
        and c.promotion_status = 'accepted'
    );
$$;
