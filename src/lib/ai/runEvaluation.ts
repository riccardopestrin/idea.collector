import type { SupabaseClient } from "@supabase/supabase-js";
import { refresh } from "next/cache";

import { anthropicClient } from "@/lib/ai/anthropic";
import { evaluateWithClaude, stubScores } from "@/lib/ai/evaluateProposal";
import { buildRepoDigest } from "@/lib/github/repoDigest";
import { getGithubSettings } from "@/lib/github/settings";
import { STRINGS } from "@/lib/strings";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Corpo post-autorizzazione della valutazione AI (RFC-003/RFC-004): chi può
// chiamarla lo decidono i chiamanti (action admin, updateProposal, promozioni);
// gli esiti si scrivono col client service-role (SEC-8, migration 0020), così
// nessun utente può forgiarli via PostgREST. Il fallimento non è mai bloccante:
// marca `fallita` e ritorna l'errore. force=true (Rilancia) salta idempotenza
// e guard in-flight.
export async function runEvaluation(
  supabase: SupabaseClient,
  proposalId: string,
  force = false,
): Promise<{ error: string } | null> {
  const { data: proposal } = await supabase
    .from("proposals")
    .select(
      `title, description, problem, links, ai_generated, manually_edited,
       contributions:comments(body, created_at, author:profiles(name))`,
    )
    .eq("id", proposalId)
    // filtro sull'embed col path dell'alias: solo i commenti promossi a contributo
    .eq("contributions.promotion_status", "accepted")
    .maybeSingle()
    .overrideTypes<
      {
        title: string;
        description: string | null;
        problem: string | null;
        links: string[];
        ai_generated: boolean;
        manually_edited: boolean;
        contributions: {
          body: string;
          created_at: string;
          author: { name: string | null } | null;
        }[];
      },
      { merge: false }
    >();
  if (!proposal) return { error: STRINGS.errors.proposalNotFound };

  // Idempotenza: se già valutata dall'AI e non toccata a mano, l'auto-trigger salta.
  if (!force && proposal.ai_generated && !proposal.manually_edited) return null;

  // force (Rilancia) bypassa anche il guard in-flight della RPC: recupera le
  // valutazioni rimaste 'in_corso' per un crash tra begin e fail (migration 0011).
  const admin = supabaseAdmin();
  const { data: began, error: beginError } = await admin.rpc("begin_ai_evaluation", {
    p_id: proposalId,
    p_force: force,
  });
  if (beginError) {
    console.error("runEvaluation begin:", beginError);
    return { error: STRINGS.evaluation.startFailed };
  }
  if (!began) {
    // senza force: già in corso, una sola valutazione in-flight. Con force può
    // essere solo una proposta sparita nel frattempo.
    return force ? { error: STRINGS.errors.proposalNotFound } : null;
  }

  // il refresh qui rende visibile 'in_corso' agli altri client; chi ha lanciato
  // l'azione vede l'aggiornamento solo al ritorno dell'azione (limite di Next)
  refresh();

  try {
    const settings = await getGithubSettings(supabase);
    if (!settings?.github_installation_id || !settings.github_owner || !settings.github_repo) {
      throw new Error(STRINGS.github.notConnected);
    }
    const digest = await buildRepoDigest(
      settings.github_installation_id,
      settings.github_owner,
      settings.github_repo,
    );
    const input = {
      ...proposal,
      contributions: proposal.contributions
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((c) => ({ author: c.author?.name ?? null, body: c.body })),
    };
    // ponytail: AI_EVAL_FAKE=1 salta Claude (demo senza crediti); il digest
    // GitHub viene comunque costruito così il resto della pipeline è reale.
    const scores =
      process.env.AI_EVAL_FAKE === "1"
        ? stubScores()
        : await evaluateWithClaude(anthropicClient(), input, digest);
    const { error: applyError } = await admin.rpc("apply_ai_evaluation", {
      p_id: proposalId,
      p_reach: scores.reach,
      p_impact: scores.impact,
      p_confidence: scores.confidence,
      p_effort: scores.effort,
      p_rationale: scores.rationale,
    });
    if (applyError) throw new Error(applyError.message);
    refresh();
    return null;
  } catch (err) {
    const message = err instanceof Error ? err.message : "errore sconosciuto";
    console.error("runEvaluation:", err);
    await admin.rpc("fail_ai_evaluation", { p_id: proposalId, p_error: message });
    refresh();
    return { error: STRINGS.evaluation.failed(message) };
  }
}
