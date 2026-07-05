import { ProposalDiscussion } from "@/components/detail/ProposalDiscussion";
import { RiceVoteForm } from "@/components/detail/RiceVoteForm";
import { SectionTitle } from "@/components/detail/SectionTitle";
import { EvalStatusCue } from "@/components/evaluation/EvalStatusCue";
import { RetryEvaluationButton } from "@/components/evaluation/RetryEvaluationButton";
import { STATUS_LABELS } from "@/lib/board";
import {
  computeCompositeScore,
  computeVoteScore,
  formatScore,
  personLabel,
  type ProposalDetail,
  type VoteComponents,
} from "@/lib/proposals";

const dateFormat = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "medium",
  timeStyle: "short",
});

// Ordine e label dei fattori RICE-10 mostrati come medie in alto (effort = Ease).
const COMPONENT_LABELS = {
  reach: "Reach",
  impact: "Impact",
  confidence: "Confidence",
  effort: "Ease",
} as const;

// I link sono input utente salvato verbatim (be-careful 2026-06-28-lnk1):
// solo http/https diventano anchor, il resto è testo inerte.
function isHttpUrl(link: string): boolean {
  return /^https?:\/\//i.test(link);
}

// Stati in cui la proposta è ancora "aperta": edit e commenti consentiti.
// Da 'approvata' in poi si cristallizza (RFC-004, backstop migration 0013).
const OPEN_STATUSES = ["nuova", "in_valutazione"];

// Pannello di dettaglio proposta: campi, punteggi se valutata, cronologia
// stati, commenti a lato. Server Component condiviso dalla pagina piena e dal
// modal; il layout a colonne, l'edit mode e i commenti ancorati vivono nel
// client ProposalDiscussion.
export function ProposalPanel({
  detail,
  isAdmin,
  currentUserId,
}: {
  detail: ProposalDetail;
  isAdmin?: boolean;
  currentUserId?: string;
}) {
  const composite = computeCompositeScore(detail, detail.votes);
  const claudeTotal = composite.claudeTotal;
  const componentAverages = (Object.keys(COMPONENT_LABELS) as (keyof VoteComponents)[])
    .map((field) => ({ field, value: composite.components[field] }))
    .filter((c): c is { field: keyof VoteComponents; value: number } => c.value !== null);
  const isOpen = OPEN_STATUSES.includes(detail.status);
  const canEdit = isOpen && (isAdmin === true || currentUserId === detail.proposer_id);
  const hasVoted = detail.votes.some((vote) => vote.voter_id === currentUserId);
  const canVote =
    detail.status === "in_valutazione" &&
    currentUserId !== undefined &&
    currentUserId !== detail.proposer_id &&
    !hasVoted;

  return (
    <article className="p-6">
      <ProposalDiscussion
        proposalId={detail.id}
        defaults={{
          title: detail.title,
          description: detail.description,
          problem: detail.problem,
          links: detail.links,
        }}
        canEdit={canEdit}
        canComment={isOpen}
        comments={detail.comments}
        currentUserId={currentUserId}
        header={
          <header className="flex flex-col gap-1 pr-6">
            <h1 className="flex items-center gap-2 text-xl font-semibold">
              {detail.title}
              <EvalStatusCue status={detail.ai_eval_status} />
            </h1>
            <p className="text-sm text-foreground/60">
              {STATUS_LABELS[detail.status]} · di {personLabel(detail.proposer)} ·{" "}
              {dateFormat.format(new Date(detail.created_at))}
            </p>
          </header>
        }
      >
        {composite.total !== null && (
          <section className="flex flex-col gap-2 rounded-lg border border-border p-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm text-foreground/60">
                Voto totale RICE-10 ·{" "}
                {claudeTotal !== null ? "Claude + utenti" : "utenti"}
              </span>
              <span className="text-4xl font-semibold">{formatScore(composite.total)}</span>
              <span className="text-xs text-foreground/50">su 10</span>
            </div>
            {componentAverages.length > 0 && (
              <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
                {componentAverages.map(({ field, value }) => (
                  <div key={field} className="flex flex-col">
                    <dt className="text-foreground/50">{COMPONENT_LABELS[field]}</dt>
                    <dd className="font-medium text-foreground/80">{formatScore(value)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        )}

        {canVote && <RiceVoteForm proposalId={detail.id} />}

        {detail.links.length > 0 && (
          <section className="flex flex-col gap-1">
            <SectionTitle>Link</SectionTitle>
            <ul className="flex flex-col gap-1 text-sm">
              {detail.links.map((link) => (
                <li key={link} className="break-all">
                  {isHttpUrl(link) ? (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-foreground/80 underline underline-offset-2"
                    >
                      {link}
                    </a>
                  ) : (
                    <span className="text-foreground/60">{link}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Rilancia anche su in_corso: recupera valutazioni orfane di un crash (0011) */}
        {detail.ai_eval_status === "fallita" && (
          <section className="flex flex-col gap-2 rounded-lg border border-danger/40 p-3">
            <p role="alert" className="text-sm text-danger">
              Valutazione AI fallita{detail.ai_eval_error ? `: ${detail.ai_eval_error}` : "."}
            </p>
            {isAdmin && <RetryEvaluationButton proposalId={detail.id} />}
          </section>
        )}
        {detail.ai_eval_status === "in_corso" && isAdmin && (
          <section className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <p className="text-sm text-foreground/70">Valutazione AI in corso…</p>
            <RetryEvaluationButton proposalId={detail.id} />
          </section>
        )}

        {claudeTotal !== null && (
          <section className="flex flex-col gap-2">
            <SectionTitle>Voto di Claude</SectionTitle>
            <div>
              <span className="text-2xl font-semibold">{formatScore(claudeTotal)}</span>
              <span className="text-sm text-foreground/50"> su 10</span>
            </div>
            {detail.ai_rationale && (
              <p className="whitespace-pre-wrap text-sm text-foreground/70">
                {detail.ai_rationale}
              </p>
            )}
          </section>
        )}

        {detail.votes.length > 0 && (
          <section className="flex flex-col gap-2">
            <SectionTitle>Voti utenti ({detail.votes.length})</SectionTitle>
            <ul className="flex flex-col gap-1 text-sm">
              {detail.votes.map((vote) => {
                const voteScore = computeVoteScore(vote);
                return (
                  <li key={vote.id} className="flex items-center justify-between gap-4">
                    <span className="text-foreground/80">{personLabel(vote.voter)}</span>
                    {voteScore !== null && (
                      <span className="font-medium text-foreground">
                        {formatScore(voteScore)}
                        <span className="text-xs text-foreground/50"> / 10</span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {detail.internal_notes && (
          <section className="flex flex-col gap-1">
            <SectionTitle>Note interne</SectionTitle>
            <p className="whitespace-pre-wrap text-sm text-foreground/80">
              {detail.internal_notes}
            </p>
          </section>
        )}

        <details className="group flex flex-col gap-1">
          <summary className="flex cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden">
            <span aria-hidden className="text-foreground/50 transition-transform group-open:rotate-90">
              ▸
            </span>
            <SectionTitle>Cronologia stati</SectionTitle>
          </summary>
          {detail.status_history.length === 0 ? (
            <p className="mt-1 text-sm text-foreground/60">Nessuno spostamento ancora.</p>
          ) : (
            <ul className="mt-1 flex flex-col gap-1 text-sm">
              {detail.status_history.map((entry) => (
                <li key={entry.id} className="text-foreground/80">
                  {entry.from_status ? `${STATUS_LABELS[entry.from_status]} → ` : ""}
                  {STATUS_LABELS[entry.to_status]}
                  <span className="text-foreground/50">
                    {" "}
                    · {personLabel(entry.author)} · {dateFormat.format(new Date(entry.created_at))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </details>
      </ProposalDiscussion>
    </article>
  );
}
