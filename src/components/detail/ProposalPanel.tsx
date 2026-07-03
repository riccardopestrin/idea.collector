import { ProposalDiscussion } from "@/components/detail/ProposalDiscussion";
import { SectionTitle } from "@/components/detail/SectionTitle";
import { EvalStatusCue } from "@/components/evaluation/EvalStatusCue";
import { RetryEvaluationButton } from "@/components/evaluation/RetryEvaluationButton";
import { STATUS_LABELS } from "@/lib/board";
import {
  computeRiceScore,
  formatScore,
  personLabel,
  type ProposalDetail,
} from "@/lib/proposals";

const dateFormat = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "medium",
  timeStyle: "short",
});

const SCORE_FIELDS = ["reach", "impact", "confidence", "effort"] as const;

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
  const scores = SCORE_FIELDS.filter((f) => detail[f] !== null);
  const totalScore = computeRiceScore(detail);
  const isOpen = OPEN_STATUSES.includes(detail.status);
  const canEdit = isOpen && (isAdmin === true || currentUserId === detail.proposer_id);

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

        {scores.length > 0 && (
          <section className="flex flex-col gap-2">
            <SectionTitle>Punteggio {detail.method.toUpperCase()}</SectionTitle>
            <dl className="flex items-end gap-6 text-sm">
              {totalScore !== null && (
                <div>
                  <dt className="text-foreground/60">Voto totale</dt>
                  <dd className="text-2xl font-semibold">{formatScore(totalScore)}</dd>
                </div>
              )}
              {scores.map((field) => (
                <div key={field}>
                  <dt className="capitalize text-foreground/60">{field}</dt>
                  <dd className="font-medium">{formatScore(detail[field]!)}</dd>
                </div>
              ))}
            </dl>
            {detail.ai_rationale && (
              <p className="whitespace-pre-wrap text-sm text-foreground/70">
                {detail.ai_rationale}
              </p>
            )}
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

        <section className="flex flex-col gap-1">
          <SectionTitle>Cronologia stati</SectionTitle>
          {detail.status_history.length === 0 ? (
            <p className="text-sm text-foreground/60">Nessuno spostamento ancora.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
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
        </section>
      </ProposalDiscussion>
    </article>
  );
}
