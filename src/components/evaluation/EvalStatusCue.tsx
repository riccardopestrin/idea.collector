import type { AiEvalStatus } from "@/lib/proposals";
import { STRINGS } from "@/lib/strings";

// Cue visivo dello stato di valutazione AI (RFC-003): quadrato che ruota = in
// corso, quadrato pieno nero = completata, paprika = fallita. Condiviso da card e pannello.
export function EvalStatusCue({ status }: { status: AiEvalStatus }) {
  if (status === "assente") return null;
  if (status === "in_corso") {
    return (
      <span
        role="status"
        aria-label={STRINGS.evaluation.cueInProgress}
        className="inline-block size-2.5 shrink-0 animate-spin border-2 border-ink/25 border-t-ink"
      />
    );
  }
  const failed = status === "fallita";
  return (
    <span
      role="img"
      aria-label={failed ? STRINGS.evaluation.cueFailed : STRINGS.evaluation.cueCompleted}
      className={`inline-block size-2.5 shrink-0 ${failed ? "bg-danger" : "bg-ink"}`}
    />
  );
}
