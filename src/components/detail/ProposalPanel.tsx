import { EvalStatusCue } from "@/components/evaluation/EvalStatusCue";
import { RetryEvaluationButton } from "@/components/evaluation/RetryEvaluationButton";
import { STATUS_LABELS } from "@/lib/board";
import {
  computeRiceScore,
  formatScore,
  personLabel,
  type ProposalDetail,
} from "@/lib/proposals";

import { CommentForm } from "./CommentForm";

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

// Pannello di dettaglio proposta (Step 4): mostra tutto — campi, punteggi se
// valutata, cronologia stati, commenti. Server Component condiviso dalla
// pagina piena e dal modal; le parti client sono form commenti e "Rilancia".
// isAdmin abilita il rilancio della valutazione fallita.
export function ProposalPanel({
  detail,
  isAdmin,
}: {
  detail: ProposalDetail;
  isAdmin?: boolean;
}) {
  const scores = SCORE_FIELDS.filter((f) => detail[f] !== null);
  const totalScore = computeRiceScore(detail);

  return (
    <article className="flex flex-col gap-5 p-6">
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

      {detail.description && <Section title="Descrizione">{detail.description}</Section>}
      {detail.problem && <Section title="Problema / motivazione">{detail.problem}</Section>}

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
        <Section title="Note interne">{detail.internal_notes}</Section>
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

      <section className="flex flex-col gap-3 border-t border-border pt-4">
        <SectionTitle>Commenti e osservazioni</SectionTitle>
        {detail.comments.length === 0 ? (
          <p className="text-sm text-foreground/60">Nessun commento ancora.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {detail.comments.map((comment) => (
              <li key={comment.id} className="rounded-lg border border-border p-3">
                <p className="text-xs text-foreground/50">
                  {personLabel(comment.author)} ·{" "}
                  {dateFormat.format(new Date(comment.created_at))}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{comment.body}</p>
              </li>
            ))}
          </ul>
        )}
        <CommentForm proposalId={detail.id} />
      </section>
    </article>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold">{children}</h2>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <SectionTitle>{title}</SectionTitle>
      <p className="whitespace-pre-wrap text-sm text-foreground/80">{children}</p>
    </section>
  );
}
