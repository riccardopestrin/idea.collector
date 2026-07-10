import type { AiEvalStatus } from "@/lib/proposals";
import { STRINGS } from "@/lib/strings";

// Cue visivo dello stato di valutazione AI (RFC-003): rotella = in corso,
// pallino verde = completata, rosso = fallita. Condiviso da card e pannello.
export function EvalStatusCue({ status }: { status: AiEvalStatus }) {
  if (status === "assente") return null;
  if (status === "in_corso") {
    return (
      <span
        role="status"
        aria-label={STRINGS.evaluation.cueInProgress}
        className="inline-block size-3 shrink-0 animate-spin rounded-full border-2 border-foreground/25 border-t-foreground"
      />
    );
  }
  const failed = status === "fallita";
  return (
    <span
      role="img"
      aria-label={failed ? STRINGS.evaluation.cueFailed : STRINGS.evaluation.cueCompleted}
      className={`inline-block size-2.5 shrink-0 rounded-full ${failed ? "bg-danger" : "bg-emerald-500"}`}
    />
  );
}
