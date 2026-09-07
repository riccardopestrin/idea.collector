"use client";

import { useActionState, useState } from "react";

import { inviteMember, type InviteResult, removeMember, setMemberRole } from "@/app/projects/actions";
import { controlClass, dangerLinkClass, displayClass, labelClass, linkClass } from "@/lib/tokens";
import { SubmitButton } from "@/components/form/SubmitButton";
import type { Member } from "@/lib/projects";
import { STRINGS } from "@/lib/strings";

// Sezione "Membri" delle impostazioni progetto, solo admin: elenco con cambio
// ruolo e rimozione (con conferma), più il form di invito (email + flag admin).
// Le regole (niente auto-demote/auto-rimozione) vivono nelle Server Action e
// nelle policy di project_members (migration 0021).
export function MembersSection({
  projectId,
  members,
  currentUserId,
}: {
  projectId: string;
  members: Member[];
  currentUserId: string;
}) {
  const [inviteState, inviteAction, invitePending] = useActionState(
    inviteMember.bind(null, projectId),
    null as InviteResult | null,
  );

  return (
    <section className="flex w-full max-w-lg flex-col gap-4 border-t border-ink pt-6">
      <h2 className={`${displayClass} text-2xl`}>{STRINGS.members.heading}</h2>
      <p className="text-sm text-foreground/60">{STRINGS.members.intro}</p>

      <ul className="flex flex-col divide-y divide-ink border border-ink text-sm">
        {members.map((m) => (
          <MemberItem
            key={m.id}
            projectId={projectId}
            member={m}
            isSelf={m.id === currentUserId}
          />
        ))}
      </ul>

      <form action={inviteAction} className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-48 flex-1 flex-col gap-1.5" htmlFor="invite-email">
          <span className={labelClass}>{STRINGS.members.inviteEmailLabel}</span>
          <input
            id="invite-email"
            name="email"
            type="email"
            required
            autoComplete="off"
            className={controlClass}
          />
        </label>
        <label className="flex items-center gap-1.5 py-2.5">
          <input type="checkbox" name="admin" />
          <span className={labelClass}>{STRINGS.members.inviteAsAdmin}</span>
        </label>
        <SubmitButton pending={invitePending}>{STRINGS.members.invite}</SubmitButton>
      </form>
      {inviteState && "error" in inviteState && (
        <p role="alert" className="text-sm text-danger">
          {inviteState.error}
        </p>
      )}
      {inviteState && !("error" in inviteState) && (
        <p role="status" className="font-mono text-sm text-foreground/70">
          {"invited" in inviteState
            ? STRINGS.members.invited(inviteState.invited)
            : STRINGS.members.added(inviteState.added)}
        </p>
      )}
    </section>
  );
}

function MemberItem({
  projectId,
  member,
  isSelf,
}: {
  projectId: string;
  member: Member;
  isSelf: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [roleState, roleAction, rolePending] = useActionState(
    async (_prev: { error: string } | null, formData: FormData) =>
      setMemberRole(projectId, member.id, String(formData.get("role"))),
    null,
  );
  const [removeState, removeAction, removePending] = useActionState(
    async () => removeMember(projectId, member.id),
    null,
  );
  const error = roleState?.error ?? removeState?.error;

  return (
    <li className="flex flex-col gap-1 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 break-all">
          <span className="font-medium">{member.name ?? member.email}</span>
          {member.name && <span className="font-mono text-xs text-foreground/50"> · {member.email}</span>}
          {isSelf && <span className="text-foreground/50"> ({STRINGS.members.you})</span>}
        </span>
        <div className="flex items-center gap-2">
          {/* il <select> invia al change: una form per riga, niente bottone Salva.
              key: React resetta il form dopo l'action e una select non controllata
              tornerebbe al defaultValue del mount — rimontarla mostra il ruolo nuovo */}
          <form action={roleAction}>
            <select
              key={member.role}
              name="role"
              aria-label={STRINGS.members.roleLabel(member.email)}
              defaultValue={member.role}
              disabled={isSelf || rolePending}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              className={`${controlClass} font-mono text-xs disabled:opacity-50`}
            >
              <option value="admin">{STRINGS.members.role.admin}</option>
              <option value="contributor">{STRINGS.members.role.contributor}</option>
            </select>
          </form>
          {!isSelf &&
            (confirming ? (
              <form action={removeAction} className="flex items-center gap-2 font-mono text-xs">
                <button
                  type="submit"
                  disabled={removePending}
                  className={dangerLinkClass}
                >
                  {STRINGS.members.confirmRemove}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className={linkClass}
                >
                  {STRINGS.common.cancel}
                </button>
              </form>
            ) : (
              <button
                type="button"
                aria-label={STRINGS.members.removeAria(member.email)}
                onClick={() => setConfirming(true)}
                className={`font-mono text-xs ${dangerLinkClass}`}
              >
                {STRINGS.members.remove}
              </button>
            ))}
        </div>
      </div>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </li>
  );
}
