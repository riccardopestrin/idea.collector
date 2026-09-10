import Link from "next/link";

import { setGitRef, setTaskUrl } from "@/app/proposals/[id]/actions";
import { ProposalDiscussion } from "@/components/detail/ProposalDiscussion";
import { RefSection } from "@/components/detail/RefSection";
import { ProposalScanTrigger } from "@/components/detail/ProposalScanTrigger";
import { RiceVoteForm } from "@/components/detail/RiceVoteForm";
import { SectionTitle } from "@/components/detail/SectionTitle";
import { EvalStatusCue } from "@/components/evaluation/EvalStatusCue";
import { ChevronRightIcon, WarningIcon } from "@/components/icons";
import { RetryButton } from "@/components/evaluation/RetryButton";
import {
  acceptedContributorIds,
  computeCompositeScore,
  computeVoteScore,
  formatScore,
  personLabel,
  type ProposalDetail,
  type VoteComponents,
} from "@/lib/proposals";
import { formatDateTime } from "@/lib/dates";
import { gitRefUrl } from "@/lib/github/gitRef";
import { STRINGS } from "@/lib/strings";
import { displayClass, labelClass, linkClass } from "@/lib/tokens";

// Ordine e label dei fattori RICE-10 mostrati come medie in alto (effort = Ease).
const COMPONENT_LABELS = STRINGS.rice.factors;

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
            className={`break-all ${linkClass}`}
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
  repo,
  fill = false,
}: {
  detail: ProposalDetail;
  isAdmin?: boolean;
  currentUserId?: string;
  // repo GitHub collegata al progetto (projects, 0021): serve per linkare git_ref
  repo?: { owner: string; name: string } | null;
  // fill: il pannello riempie l'altezza del modal (le due colonne scrollano)
  fill?: boolean;
}) {
  const composite = computeCompositeScore(detail, detail.votes);
  const claudeTotal = composite.claudeTotal;
  const componentAverages = (Object.keys(COMPONENT_LABELS) as (keyof VoteComponents)[])
    .map((field) => ({ field, value: composite.components[field] }))
    .filter((c): c is { field: keyof VoteComponents; value: number } => c.value !== null);
  const isProposerOrAdmin = isAdmin === true || currentUserId === detail.proposer_id;
  // scan duplicati (RFC-006): trigger/rilancio del proposer o admin, solo in 'nuova'
  const canScan = detail.status === "nuova" && isProposerOrAdmin;
  // commenti promossi a contributo: parte dell'idea, resi sotto il body
  const contributions = detail.comments.filter((c) => c.promotion_status === "accepted");
  const contributorIds = acceptedContributorIds(detail.comments);
  // #9c: si può votare in ogni stato tranne 'nuova'. #8: il voto è modificabile,
  // quindi chi ha già votato vede il form precompilato invece di esserne escluso.
  const myVote = detail.votes.find((vote) => vote.voter_id === currentUserId) ?? null;
  const canVote =
    detail.status !== "nuova" &&
    currentUserId !== undefined &&
    currentUserId !== detail.proposer_id &&
    !contributorIds.has(currentUserId);

  return (
    <article className={`p-8 sm:p-10 ${fill ? "flex min-h-0 flex-1 flex-col" : ""}`}>
      <ProposalDiscussion
        fill={fill}
        proposalId={detail.id}
        defaults={{
          title: detail.title,
          description: detail.description,
          links: detail.links,
        }}
        // #10: edit e commenti in ogni stato (niente più cristallizzazione)
        canEdit={isProposerOrAdmin}
        comments={detail.comments}
        currentUserId={currentUserId}
        proposerId={detail.proposer_id}
        isAdmin={isAdmin}
        header={
          <header className="flex flex-col gap-2 pr-8">
            <h1 className={`flex flex-wrap items-center gap-3 ${displayClass} text-3xl tracking-tight`}>
              {detail.title}
              <EvalStatusCue status={detail.ai_eval_status} />
            </h1>
            <p className="font-mono text-sm uppercase tracking-widest text-foreground/60">
              {STRINGS.status[detail.status]} · {STRINGS.panel.byLine(personLabel(detail.proposer))}
              {/* dedupe per author_id, non per label: due omonimi restano distinti */}
              {contributions.length > 0 &&
                ` · ${STRINGS.panel.withLine(
                  [...new Map(contributions.map((c) => [c.author_id, c.author])).values()]
                    .map(personLabel)
                    .join(", "),
                )}`}{" "}
              · {formatDateTime(detail.created_at)}
            </p>
          </header>
        }
      >
        {contributions.length > 0 && (
          <section className="flex flex-col gap-3">
            <SectionTitle>{STRINGS.panel.contributions}</SectionTitle>
            {contributions.map((c) => (
              <div key={c.id} className="flex flex-col gap-1 border-l-2 border-paprika pl-3">
                <p className="whitespace-pre-wrap text-sm">{c.body}</p>
                <p className="font-mono text-xs text-foreground/50">— {personLabel(c.author)}</p>
              </div>
            ))}
          </section>
        )}
        {composite.total !== null && (
          <section className="flex flex-col gap-3 border border-ink p-4">
            <div className="flex flex-col gap-1">
              <span className={`${labelClass} text-foreground/60`}>
                {STRINGS.panel.totalVote} ·{" "}
                {claudeTotal !== null ? STRINGS.panel.claudePlusUsers : STRINGS.panel.usersOnly}
              </span>
              <span className={`${displayClass} text-6xl`}>{formatScore(composite.total)}</span>
              <span className="font-mono text-xs text-foreground/50">{STRINGS.panel.outOf10}</span>
            </div>
            {componentAverages.length > 0 && (
              <dl className="grid grid-cols-2 border-t border-ink pt-3 font-mono text-xs sm:grid-cols-4">
                {componentAverages.map(({ field, value }) => (
                  <div key={field} className="flex flex-col gap-0.5">
                    <dt className="uppercase tracking-wider text-foreground/50">{COMPONENT_LABELS[field]}</dt>
                    <dd className="text-base font-medium">{formatScore(value)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        )}

        {canVote && (
          <RiceVoteForm proposalId={detail.id} status={detail.status} existingVote={myVote} />
        )}

        {detail.links.length > 0 && (
          <section className="flex flex-col gap-1">
            <SectionTitle>{STRINGS.panel.linksHeading}</SectionTitle>
            <ul className="flex flex-col gap-1 font-mono text-sm">
              {detail.links.map((link) => (
                <li key={link} className="break-all">
                  {isHttpUrl(link) ? (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={linkClass}
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

        {(detail.git_ref || isProposerOrAdmin) && (
          <RefSection
            texts={STRINGS.proposal.gitRef}
            name="git_ref"
            value={detail.git_ref}
            href={detail.git_ref && repo ? gitRefUrl(detail.git_ref, repo) : null}
            canEdit={isProposerOrAdmin}
            action={setGitRef.bind(null, detail.id)}
          />
        )}
        {(detail.task_url || isProposerOrAdmin) && (
          <RefSection
            texts={STRINGS.proposal.taskUrl}
            name="task_url"
            value={detail.task_url}
            href={detail.task_url}
            canEdit={isProposerOrAdmin}
            action={setTaskUrl.bind(null, detail.id)}
          />
        )}

        {/* Rilancia anche su in_corso: recupera valutazioni orfane di un crash (0011) */}
        {detail.ai_eval_status === "fallita" && (
          <section className="flex flex-col gap-2 border border-danger p-3">
            <p role="alert" className="text-sm text-danger">
              {STRINGS.panel.evalFailed(detail.ai_eval_error)}
            </p>
            {isAdmin && <RetryButton proposalId={detail.id} />}
          </section>
        )}
        {detail.ai_eval_status === "in_corso" && isAdmin && (
          <section className="flex flex-col gap-2 border border-dust p-3">
            <p className="font-mono text-sm text-foreground/70">{STRINGS.panel.evalInProgress}</p>
            <RetryButton proposalId={detail.id} />
          </section>
        )}

        {claudeTotal !== null && (
          <section className="flex flex-col gap-2">
            <SectionTitle>{STRINGS.panel.claudeVote}</SectionTitle>
            <div>
              <span className={`${displayClass} text-3xl`}>{formatScore(claudeTotal)}</span>
              <span className="font-mono text-xs text-foreground/50"> {STRINGS.panel.outOf10}</span>
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
            <SectionTitle>{STRINGS.panel.userVotes} ({detail.votes.length})</SectionTitle>
            <ul className="flex flex-col divide-y divide-dust border-y border-dust text-sm">
              {detail.votes.map((vote) => {
                const voteScore = computeVoteScore(vote);
                return (
                  <li key={vote.id} className="flex items-center justify-between gap-4 py-1.5">
                    <span className="text-foreground/80">{personLabel(vote.voter)}</span>
                    {voteScore !== null && (
                      <span className="font-mono font-medium text-foreground">
                        {formatScore(voteScore)}
                        <span className="text-xs text-foreground/50"> {STRINGS.panel.perTen}</span>
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
            <SectionTitle>{STRINGS.panel.internalNotes}</SectionTitle>
            <p className="whitespace-pre-wrap text-sm text-foreground/80">
              {detail.internal_notes}
            </p>
          </section>
        )}

        <details className="group flex flex-col gap-1">
          <summary className="flex w-fit list-none items-center gap-1.5 hover:text-paprika [&::-webkit-details-marker]:hidden">
            <ChevronRightIcon className="size-3 text-foreground/50 transition-transform group-open:rotate-90" />
            <SectionTitle>{STRINGS.panel.historyHeading}</SectionTitle>
          </summary>
          {detail.status_history.length === 0 ? (
            <p className="mt-1 text-sm text-foreground/60">{STRINGS.panel.historyEmpty}</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1 font-mono text-xs">
              {detail.status_history.map((entry) => (
                <li key={entry.id} className="text-foreground/80">
                  {entry.from_status ? `${STRINGS.status[entry.from_status]} → ` : ""}
                  {STRINGS.status[entry.to_status]}
                  <span className="text-foreground/50">
                    {" "}
                    · {personLabel(entry.author)} · {formatDateTime(entry.created_at)}
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
              <SectionTitle>{STRINGS.panel.scanHeading}</SectionTitle>
              <EvalStatusCue status={detail.dup_scan_status} />
            </span>
            {detail.dup_flagged && (
              <div className="flex flex-col gap-1 border border-danger p-3">
                <p role="alert" className="text-sm text-danger">
                  <WarningIcon className="mr-1.5 inline size-4 align-[-3px]" />
                  {STRINGS.panel.dupWarning}
                  {detail.dup_similarity !== null &&
                    ` (${STRINGS.panel.similar(detail.dup_similarity)}`}
                  {detail.dup_match && (
                    <>
                      {" "}
                      {STRINGS.panel.dupLinkIntro}{" "}
                      <Link
                        href={`/proposals/${detail.dup_match.id}`}
                        className={linkClass}
                      >
                        «{detail.dup_match.title}»
                      </Link>{" "}
                      {STRINGS.panel.byLine(personLabel(detail.dup_match.proposer))}
                    </>
                  )}
                  {detail.dup_similarity !== null && ")"}.
                </p>
                <p className="text-xs text-foreground/60">{STRINGS.panel.dupBlockedHint}</p>
              </div>
            )}
            {/* "in corso" anche su assente+canScan: il trigger qui sopra sta
                partendo in questo stesso render. Per gli altri viewer con scan
                'assente' niente messaggio: nulla sta girando. */}
            {(detail.dup_scan_status === "in_corso" ||
              (canScan && detail.dup_scan_status === "assente")) && (
              <p className="font-mono text-sm text-foreground/60">{STRINGS.panel.scanInProgress}</p>
            )}
            {detail.dup_report && <ReportText text={detail.dup_report} />}
            {detail.dup_scan_status === "fallita" && (
              <p role="alert" className="text-sm text-danger">
                {STRINGS.panel.scanFailed(detail.dup_scan_error)}
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
