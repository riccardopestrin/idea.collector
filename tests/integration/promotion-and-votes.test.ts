import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  computeCompositeScore,
  computeVoteScore,
  getProposalDetail,
  listProposals,
} from "@/lib/proposals";

// Scenario full-stack sul DB locale (RLS + RPC reali, stesso data layer
// dell'app): Paola propone, Carlo commenta e il commento viene promosso a
// contributo, Vera vota. Verifica promozione, sospensione del voto del
// contributore, composito, revoca e — SEC-9 — che nessun utente possa
// scrivere gli esiti dello scan duplicati. Le Server Action Next non sono
// invocabili da CLI: qui si testa tutto ciò che sta sotto di esse.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Session = { client: SupabaseClient; id: string; name: string };
const run = Date.now().toString(36);

async function loginAs(name: string): Promise<Session> {
  const email = `${name.toLowerCase()}-${run}@test.local`;
  const password = `pw-${run}-${name}`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) throw createError;
  await admin.from("profiles").update({ name }).eq("id", created.user.id);
  const client = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { client, id: created.user.id, name };
}

let paola: Session; // proposer, admin del progetto
let carlo: Session; // commenter → contributore
let vera: Session; // votante
let projectId: string;
let proposalId: string;
let commentId: string;
const veraVote = { reach: 8, impact: 6, confidence: 7, effort: 5 };

beforeAll(async () => {
  [paola, carlo, vera] = await Promise.all([loginAs("Paola"), loginAs("Carlo"), loginAs("Vera")]);
  // Progetto (0021): Paola lo crea (→ admin) e invita gli altri due come membri.
  const { data, error } = await paola.client.rpc("create_project", { p_name: `Integrazione ${run}` });
  if (error) throw error;
  projectId = data as string;
  const { error: memberError } = await paola.client
    .from("project_members")
    .insert([carlo, vera].map((s) => ({ project_id: projectId, user_id: s.id })));
  if (memberError) throw memberError;
});

afterAll(async () => {
  // le proposte seguono il progetto (FK on delete cascade)
  if (projectId) await admin.from("projects").delete().eq("id", projectId);
  for (const s of [paola, carlo, vera]) {
    if (s) await admin.auth.admin.deleteUser(s.id);
  }
});

describe("proposal → contribution → votes", () => {
  it("Paola creates a proposal and moves it into evaluation", async () => {
    const { data, error } = await paola.client
      .from("proposals")
      .insert({
        title: `Mappa offline ${run}`,
        description: "Serve senza rete",
        proposer_id: paola.id,
        project_id: projectId,
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    proposalId = data!.id;

    const { data: moved, error: moveError } = await paola.client.rpc("move_proposal", {
      p_id: proposalId,
      p_from: "nuova",
      p_to: "in_valutazione",
    });
    expect(moveError).toBeNull();
    expect(moved).toBe(true);
  });

  it("Carlo comments and proposes the comment as a contribution", async () => {
    const { data, error } = await carlo.client
      .from("comments")
      .insert({ proposal_id: proposalId, author_id: carlo.id, body: "Aggiungerei la cache tile" })
      .select("id")
      .single();
    expect(error).toBeNull();
    commentId = data!.id;

    const { data: requested } = await carlo.client.rpc("request_comment_promotion", {
      p_comment_id: commentId,
    });
    expect(requested).toBe(true);

    const detail = await getProposalDetail(vera.client, proposalId);
    expect(detail?.comments.map((c) => c.promotion_status)).toEqual(["pending"]);
  });

  it("only the proposer (or an admin) can accept: Vera is refused, Paola incorporates it", async () => {
    const refused = await vera.client.rpc("resolve_comment_promotion", {
      p_comment_id: commentId,
      p_accept: true,
    });
    expect(refused.error).not.toBeNull();

    const { data: accepted, error } = await paola.client.rpc("resolve_comment_promotion", {
      p_comment_id: commentId,
      p_accept: true,
    });
    expect(error).toBeNull();
    expect(accepted).toBe(true);

    const [item] = (await listProposals(vera.client, { projectId })).filter((p) => p.id === proposalId);
    expect(item.contributors.map((c) => c?.name)).toEqual(["Carlo"]);
  });

  it("the contributor and the proposer cannot vote; Vera can", async () => {
    const carloVote = await carlo.client
      .from("rice_votes")
      .insert({ proposal_id: proposalId, voter_id: carlo.id, ...veraVote });
    expect(carloVote.error?.code).toBe("42501");

    const paolaVote = await paola.client
      .from("rice_votes")
      .insert({ proposal_id: proposalId, voter_id: paola.id, ...veraVote });
    expect(paolaVote.error?.code).toBe("42501");

    const { error } = await vera.client
      .from("rice_votes")
      .insert({ proposal_id: proposalId, voter_id: vera.id, ...veraVote });
    expect(error).toBeNull();
  });

  it("the composite score is Vera's geometric mean (no Claude score yet)", async () => {
    const detail = await getProposalDetail(paola.client, proposalId);
    expect(detail?.votes.map((v) => v.voter?.name)).toEqual(["Vera"]);

    const composite = computeCompositeScore(detail!, detail!.votes);
    expect(composite.claudeTotal).toBeNull();
    expect(composite.total).toBeCloseTo(computeVoteScore(veraVote)!, 10);
    expect(composite.total).toBeCloseTo((8 * 6 * 7 * 5) ** 0.25, 10);
  });

  it("after Carlo revokes his contribution he can vote and the composite averages both", async () => {
    const { data: revoked } = await carlo.client.rpc("revoke_comment_promotion", {
      p_comment_id: commentId,
    });
    expect(revoked).toBe(true);

    const carloVote = { reach: 4, impact: 4, confidence: 4, effort: 4 };
    const { error } = await carlo.client
      .from("rice_votes")
      .insert({ proposal_id: proposalId, voter_id: carlo.id, ...carloVote });
    expect(error).toBeNull();

    const detail = await getProposalDetail(paola.client, proposalId);
    expect(detail?.comments[0].promotion_status).toBe("none");
    expect(detail?.votes).toHaveLength(2);
    const expected = (computeVoteScore(veraVote)! + computeVoteScore(carloVote)!) / 2;
    expect(computeCompositeScore(detail!, detail!.votes).total).toBeCloseTo(expected, 10);
  });

  it("SEC-9: no authenticated user can write the duplicate-scan verdict; the service role can", async () => {
    const args = {
      p_id: proposalId,
      p_flagged: false,
      p_similarity: null,
      p_match: null,
      p_report: "forged",
    };
    const forged = await paola.client.rpc("apply_dup_scan", args);
    expect(forged.error?.code).toBe("42501");

    const { error } = await admin.rpc("apply_dup_scan", args);
    expect(error).toBeNull();
  });

  it("a contributor cannot change roles; the proposer can link a branch", async () => {
    // policy "admin update others" (0021): la riga viene filtrata, nessun errore, ruolo invariato
    const { error: roleError } = await carlo.client
      .from("project_members")
      .update({ role: "admin" })
      .eq("project_id", projectId)
      .eq("user_id", vera.id);
    expect(roleError).toBeNull();
    const { data: vera_membership } = await carlo.client
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", vera.id)
      .single();
    expect(vera_membership?.role).toBe("contributor");

    const { error } = await paola.client
      .from("proposals")
      .update({ git_ref: "feature/offline" })
      .eq("id", proposalId);
    expect(error).toBeNull();
    expect((await getProposalDetail(vera.client, proposalId))?.git_ref).toBe("feature/offline");
  });
});
