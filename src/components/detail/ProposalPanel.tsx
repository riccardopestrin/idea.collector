import Link from "next/link";

import { ProposalDiscussion } from "@/components/detail/ProposalDiscussion";
import { ProposalScanTrigger } from "@/components/detail/ProposalScanTrigger";
import { RiceVoteForm } from "@/components/detail/RiceVoteForm";
import { SectionTitle } from "@/components/detail/SectionTitle";
import { EvalStatusCue } from "@/components/evaluation/EvalStatusCue";
import { RetryButton } from "@/components/evaluation/RetryButton";
import { STATUS_LABELS } from "@/lib/board";
import {
  acceptedContributorIds,
  computeCompositeScore,
  computeVoteScore,
  formatScore,
  isOpenProposalStatus,
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

// Il report dello scan (RFC-006) è prosa non fidata con URL delle fonti web:
// si linkifica SOLO ciò che matcha http/https, il resto resta testo inerte.
function ReportText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s)]+)/g);
  return (
    <p className="whitespace-pre-wrap text-sm text-foreground/70">
      {parts.map((part, i) =>
        isHttpUrl(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-foreground/80 underline underline-offset-2"
          >
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </p>
  );
}

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
  const isOpen = isOpenProposalStatus(detail.status);
  const canEdit = isOpen && (isAdmin === true || currentUserId === detail.proposer_id);
  // scan duplicati (RFC-006): trigger/rilancio del proposer o admin, solo in 'nuova'
  const canScan =
    detail.status === "nuova" && (isAdmin === true || currentUserId === detail.proposer_id);
  // commenti promossi a contributo: parte dell'idea, resi sotto il body
  const contributions = detail.comments.filter((c) => c.promotion_status === "accepted");
  const contributorIds = acceptedContributorIds(detail.comments);
  // hasVoted da solo non basta: il voto di un contributore accepted è sospeso
  // (filtrato in getProposalDetail), ma da co-autore non deve rivotare.
  const hasVoted = detail.votes.some((vote) => vote.voter_id === currentUserId);
  const canVote =
    detail.status === "in_valutazione" &&
    currentUserId !== undefined &&
    currentUserId !== detail.proposer_id &&
    !contributorIds.has(currentUserId) &&
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
        proposerId={detail.proposer_id}
        isAdmin={isAdmin}
        header={
          <header className="flex flex-col gap-1 pr-6">
            <h1 className="flex items-center gap-2 text-xl font-semibold">
              {detail.title}
              <EvalStatusCue status={detail.ai_eval_status} />
            </h1>
            <p className="text-sm text-foreground/60">
              {STATUS_LABELS[detail.status]} · di {personLabel(detail.proposer)}
              {/* dedupe per author_id, non per label: due omonimi restano distinti */}
              {contributions.length > 0 &&
                ` · con ${[...new Map(contributions.map((c) => [c.author_id, c.author])).values()]
                  .map(personLabel)
                  .join(", ")}`}{" "}
              · {dateFormat.format(new Date(detail.created_at))}
            </p>
          </header>
        }
      >
        {contributions.length > 0 && (
          <section className="flex flex-col gap-3">
            <SectionTitle>Contributi</SectionTitle>
            {contributions.map((c) => (
              <div key={c.id} className="flex flex-col gap-1 border-l-2 border-border pl-3">
                <p className="whitespace-pre-wrap text-sm">{c.body}</p>
                <p className="text-xs text-foreground/50">— {personLabel(c.author)}</p>
              </div>
            ))}
          </section>
        )}
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
            {isAdmin && <RetryButton proposalId={detail.id} />}
          </section>
        )}
        {detail.ai_eval_status === "in_corso" && isAdmin && (
          <section className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <p className="text-sm text-foreground/70">Valutazione AI in corso…</p>
            <RetryButton proposalId={detail.id} />
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

        {/* Scan anti-duplicato + competitor (RFC-006) — in fondo al pannello.
            canScan: il trigger/rilancio è del proposer o di un admin, e solo
            in 'nuova' (fuori da 'nuova' il report resta ma è storico). */}
        {(detail.status === "nuova" || detail.dup_scan_status !== "assente") && (
          <section className="flex flex-col gap-2">
            {canScan && detail.dup_scan_status === "assente" && (
              <ProposalScanTrigger proposalId={detail.id} />
            )}
            <span className="flex items-center gap-2">
              <SectionTitle>Scansione duplicati</SectionTitle>
              <EvalStatusCue status={detail.dup_scan_status} />
            </span>
            {detail.dup_flagged && (
              <div className="flex flex-col gap-1 rounded-lg border border-danger/40 p-3">
                <p role="alert" className="text-sm text-danger">
                  ⚠️ Possibile duplicato
                  {detail.dup_similarity !== null && ` (${detail.dup_similarity}% simile`}
                  {detail.dup_match && (
                    <>
                      {" "}
                      a{" "}
                      <Link
                        href={`/proposals/${detail.dup_match.id}`}
                        className="underline underline-offset-2"
                      >
                        «{detail.dup_match.title}»
                      </Link>{" "}
                      di {personLabel(detail.dup_match.proposer)}
                    </>
                  )}
                  {detail.dup_similarity !== null && ")"}.
                </p>
                <p className="text-xs text-foreground/60">
                  Non può uscire da «Nuova» finché non la modifichi per differenziarla,
                  la sposti in Rifiutata o la elimini.
                </p>
              </div>
            )}
            {/* "in corso" anche su assente+canScan: il trigger qui sopra sta
                partendo in questo stesso render. Per gli altri viewer con scan
                'assente' niente messaggio: nulla sta girando. */}
            {(detail.dup_scan_status === "in_corso" ||
              (canScan && detail.dup_scan_status === "assente")) && (
              <p className="text-sm text-foreground/60">
                Scansione delle idee simili in corso…
              </p>
            )}
            {detail.dup_report && <ReportText text={detail.dup_report} />}
            {detail.dup_scan_status === "fallita" && (
              <p role="alert" className="text-sm text-danger">
                Scansione fallita{detail.dup_scan_error ? `: ${detail.dup_scan_error}` : "."}
              </p>
            )}
            {/* Rilancia anche su in_corso: recupera scan orfani di un crash */}
            {canScan &&
              (detail.dup_scan_status === "fallita" ||
                detail.dup_scan_status === "in_corso") && (
                <RetryButton proposalId={detail.id} kind="scan" />
              )}
          </section>
        )}
      </ProposalDiscussion>
    </article>
  );
}
