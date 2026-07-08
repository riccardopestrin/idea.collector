"use client";

import { type ReactNode, useActionState, useState } from "react";

import { updateProposal } from "@/app/proposals/[id]/actions";
import type { PendingAnchor } from "@/components/detail/CommentForm";
import { CommentsSidebar } from "@/components/detail/CommentsSidebar";
import { SectionTitle } from "@/components/detail/SectionTitle";
import { RichTextField } from "@/components/editor/RichTextField";
import { RichTextViewer } from "@/components/editor/RichTextViewer";
import { Field } from "@/components/form/Field";
import { SubmitButton } from "@/components/form/SubmitButton";
import type { AnchorField } from "@/lib/anchors";
import type { ProposalComment } from "@/lib/proposals";

type ProposalDefaults = {
  title: string;
  description: string | null;
  problem: string | null;
  links: string[];
};

// Cuore client del pannello (RFC-004): layout a colonne (contenuto | commenti),
// selezione→ancora condivisa tra viewer e sidebar, toggle edit mode.
// header/children sono i pezzi server-rendered del pannello (titolo, punteggi,
// cronologia…): passano da qui solo per il posizionamento nella griglia.
export function ProposalDiscussion({
  proposalId,
  defaults,
  canEdit,
  canComment,
  comments,
  currentUserId,
  proposerId,
  isAdmin,
  header,
  children,
}: {
  proposalId: string;
  defaults: ProposalDefaults;
  canEdit: boolean;
  canComment: boolean;
  comments: ProposalComment[];
  currentUserId?: string;
  proposerId: string;
  isAdmin?: boolean;
  header: ReactNode;
  children: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [pendingAnchor, setPendingAnchor] = useState<PendingAnchor | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (editing) {
    return (
      <EditProposalForm
        proposalId={proposalId}
        defaults={defaults}
        onClose={() => setEditing(false)}
      />
    );
  }

  // Il testo è normale finché non si passa sopra un commento: allora si evidenzia
  // solo il passaggio citato da quel commento (se l'ancora risolve ancora).
  const hovered = comments.find((c) => c.id === hoveredId);
  const anchorsFor = (field: AnchorField) =>
    hovered && hovered.anchor_resolved && hovered.anchor_field === field
      ? [{ text: hovered.anchor_text!, occurrence: hovered.anchor_occurrence! }]
      : [];

  const onComment = (field: AnchorField) =>
    canComment
      ? (anchor: { quote: string; occurrence: number }) =>
          setPendingAnchor({ field, ...anchor })
      : undefined;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-2">
        {header}
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-foreground/5"
          >
            Modifica
          </button>
        )}
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-5">
          {defaults.description && (
            <section className="flex flex-col gap-1">
              <SectionTitle>Descrizione</SectionTitle>
              <RichTextViewer
                value={defaults.description}
                anchors={anchorsFor("description")}
                onComment={onComment("description")}
              />
            </section>
          )}
          {defaults.problem && (
            <section className="flex flex-col gap-1">
              <SectionTitle>Problema / motivazione</SectionTitle>
              <RichTextViewer
                value={defaults.problem}
                anchors={anchorsFor("problem")}
                onComment={onComment("problem")}
              />
            </section>
          )}
          {children}
        </div>
        <CommentsSidebar
          proposalId={proposalId}
          comments={comments}
          canComment={canComment}
          currentUserId={currentUserId}
          proposerId={proposerId}
          isAdmin={isAdmin}
          pendingAnchor={pendingAnchor}
          onCancelAnchor={() => setPendingAnchor(null)}
          onHoverComment={setHoveredId}
        />
      </div>
    </div>
  );
}

function EditProposalForm({
  proposalId,
  defaults,
  onClose,
}: {
  proposalId: string;
  defaults: ProposalDefaults;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(
    async (prev: { error: string } | null, formData: FormData) => {
      const result = await updateProposal(proposalId, prev, formData);
      if (!result) onClose();
      return result;
    },
    null,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Titolo" name="title" required defaultValue={defaults.title} />
      <RichTextField
        label="Descrizione"
        name="description"
        defaultValue={defaults.description}
      />
      <RichTextField
        label="Problema / motivazione"
        name="problem"
        defaultValue={defaults.problem}
      />
      <Field
        label="Link (uno per riga)"
        name="links"
        multiline
        defaultValue={defaults.links.join("\n")}
      />
      {state?.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <div className="flex gap-2">
        <SubmitButton pending={pending}>Salva</SubmitButton>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border px-4 py-2 text-sm"
        >
          Annulla
        </button>
      </div>
    </form>
  );
}
