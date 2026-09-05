import type { SupabaseClient } from "@supabase/supabase-js";
import { refresh } from "next/cache";

import { anthropicClient } from "@/lib/ai/anthropic";
import {
  buildScanReport,
  DUP_SIMILARITY_THRESHOLD,
  findLocalDuplicate,
  searchCompetitors,
  stubScan,
} from "@/lib/ai/scanProposal";
import { STRINGS } from "@/lib/strings";
import { supabaseAdmin } from "@/lib/supabase/admin";

// cap candidati per il judge locale (RFC-006): oltre serve un pre-filtro
// (pg_trgm/pgvector) — follow-up se il volume cresce.
const CANDIDATE_LIMIT = 100;

// Corpo post-autorizzazione dello scan anti-duplicato (RFC-006, mirror di
// runEvaluation): chi può chiamarlo lo decidono i chiamanti (action, edit);
// gli esiti si scrivono col client service-role (SEC-9, migration 0020), così il
// proposer non può forgiarli via PostgREST. Il fallimento non è mai bloccante:
// marca 'fallita' e ritorna l'errore. force=true (Rilancia / re-scan su edit)
// salta idempotenza e guard in-flight.
export async function runProposalScan(
  supabase: SupabaseClient,
  proposalId: string,
  force = false,
): Promise<{ error: string } | null> {
  const { data: proposal } = await supabase
    .from("proposals")
    .select("title, description, problem, status, dup_scan_status")
    .eq("id", proposalId)
    .maybeSingle();
  if (!proposal) return { error: STRINGS.errors.proposalNotFound };

  // Lo scan ha senso solo in 'nuova': il gate blocca solo l'uscita da lì.
  if (proposal.status !== "nuova") return null;
  // Idempotenza: l'auto-trigger on-view gira una volta sola; force ricalcola.
  if (!force && proposal.dup_scan_status !== "assente") return null;

  const admin = supabaseAdmin();
  const { data: began, error: beginError } = await admin.rpc("begin_dup_scan", {
    p_id: proposalId,
    p_force: force,
  });
  if (beginError) {
    console.error("runProposalScan begin:", beginError);
    return { error: STRINGS.evaluation.scanStartFailed };
  }
  if (!began) return null; // già in corso: una sola scan in-flight

  // rende visibile 'in_corso' agli altri client (limite di Next: chi ha
  // lanciato l'azione vede l'aggiornamento solo al ritorno dell'azione)
  refresh();

  try {
    const { data: candidates, error: candidatesError } = await supabase
      .from("proposals")
      .select("id, title, description")
      .neq("id", proposalId)
      .neq("status", "rifiutata")
      .order("created_at", { ascending: false })
      .limit(CANDIDATE_LIMIT);
    // senza questo throw un errore DB diventerebbe "zero candidati" → falso
    // negativo persistito come scan completato (review 2026-07-08, finding [2])
    if (candidatesError) throw new Error(candidatesError.message);

    const input = {
      title: proposal.title,
      description: proposal.description,
      problem: proposal.problem,
    };
    // ponytail: AI_SCAN_FAKE=1 salta Claude (demo senza crediti).
    const { local, web } =
      process.env.AI_SCAN_FAKE === "1"
        ? stubScan()
        : await (async () => {
            const client = anthropicClient();
            const [local, web] = await Promise.all([
              findLocalDuplicate(client, input, candidates ?? []),
              searchCompetitors(client, input),
            ]);
            return { local, web };
          })();

    const flagged = local.matchId !== null && local.similarity >= DUP_SIMILARITY_THRESHOLD;
    const { error: applyError } = await admin.rpc("apply_dup_scan", {
      p_id: proposalId,
      p_flagged: flagged,
      p_similarity: local.matchId === null ? null : local.similarity,
      p_match: local.matchId,
      p_report: buildScanReport(local, web),
    });
    if (applyError) throw new Error(applyError.message);
    refresh();
    return null;
  } catch (err) {
    const message = err instanceof Error ? err.message : "errore sconosciuto";
    console.error("runProposalScan:", err);
    const { error: failError } = await admin.rpc("fail_dup_scan", {
      p_id: proposalId,
      p_error: message,
    });
    // può fallire se la proposta è uscita da 'nuova' a metà scan: lo scan
    // resta 'in_corso' orfano (be-careful 2026-07-08-strd) — almeno loggato
    if (failError) console.error("runProposalScan fail_dup_scan:", failError);
    refresh();
    return { error: STRINGS.evaluation.scanFailed(message) };
  }
}
