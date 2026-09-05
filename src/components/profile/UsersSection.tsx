"use client";

import { useActionState, useState } from "react";

import { inviteUser, setUserDisabled, setUserRole } from "@/app/profile/actions";
import { controlClass } from "@/components/form/Field";
import { SubmitButton } from "@/components/form/SubmitButton";
import type { Role } from "@/lib/profiles";
import { STRINGS } from "@/lib/strings";

type InviteState = { error: string } | { invited: string } | null;

export type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  // bannato in auth.users: non può più accedere
  disabled: boolean;
};

// Sezione "Utenti" del profilo, solo admin: elenco con cambio ruolo e
// disabilita/riabilita, più il form di invito (email + flag admin). Le regole
// (niente auto-demote/auto-disabilitazione) vivono nelle Server Action e nella RPC.
export function UsersSection({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const [inviteState, inviteAction, invitePending] = useActionState(
    async (_prev: InviteState, formData: FormData): Promise<InviteState> => {
      const result = await inviteUser(null, formData);
      return result ?? { invited: String(formData.get("email")) };
    },
    null,
  );

  return (
    <section className="flex w-full max-w-lg flex-col gap-3 border-t border-border pt-6">
      <h2 className="text-lg font-semibold">{STRINGS.users.heading}</h2>
      <p className="text-sm text-foreground/60">{STRINGS.users.intro}</p>

      <ul className="flex flex-col gap-2 text-sm">
        {users.map((u) => (
          <UserItem key={u.id} user={u} isSelf={u.id === currentUserId} />
        ))}
      </ul>

      <form action={inviteAction} className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm" htmlFor="invite-email">
          {STRINGS.users.inviteEmailLabel}
          <input
            id="invite-email"
            name="email"
            type="email"
            required
            autoComplete="off"
            className={controlClass}
          />
        </label>
        <label className="flex items-center gap-1.5 py-2 text-sm">
          <input type="checkbox" name="admin" />
          {STRINGS.users.inviteAsAdmin}
        </label>
        <SubmitButton pending={invitePending}>{STRINGS.users.invite}</SubmitButton>
      </form>
      {inviteState && "error" in inviteState && (
        <p role="alert" className="text-sm text-danger">
          {inviteState.error}
        </p>
      )}
      {inviteState && "invited" in inviteState && (
        <p role="status" className="text-sm text-foreground/70">
          {STRINGS.users.invited(inviteState.invited)}
        </p>
      )}
    </section>
  );
}

function UserItem({ user, isSelf }: { user: UserRow; isSelf: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [roleState, roleAction, rolePending] = useActionState(
    async (_prev: { error: string } | null, formData: FormData) =>
      setUserRole(user.id, String(formData.get("role"))),
    null,
  );
  const [toggleState, toggleAction, togglePending] = useActionState(
    async () => setUserDisabled(user.id, !user.disabled),
    null,
  );
  const error = roleState?.error ?? toggleState?.error;

  return (
    <li className="flex flex-col gap-1 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 break-all">
          <span className="font-medium">{user.name ?? user.email}</span>
          {user.name && <span className="text-foreground/50"> · {user.email}</span>}
          {isSelf && <span className="text-foreground/50"> ({STRINGS.users.you})</span>}
          {user.disabled && (
            <span className="ml-1 rounded-full border border-border px-2 py-0.5 text-xs text-foreground/60">
              {STRINGS.users.disabledBadge}
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          {/* il <select> invia al change: una form per riga, niente bottone Salva */}
          <form action={roleAction}>
            <select
              name="role"
              aria-label={STRINGS.users.roleLabel(user.email)}
              defaultValue={user.role}
              disabled={isSelf || rolePending}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              className={`${controlClass} py-1 text-sm disabled:opacity-50`}
            >
              <option value="admin">{STRINGS.users.role.admin}</option>
              <option value="contributor">{STRINGS.users.role.contributor}</option>
            </select>
          </form>
          {/* riabilita: diretto; disabilita: con conferma */}
          {!isSelf && user.disabled && (
            <form action={toggleAction}>
              <button
                type="submit"
                aria-label={STRINGS.users.enableAria(user.email)}
                disabled={togglePending}
                className="text-xs underline underline-offset-2 disabled:opacity-50"
              >
                {STRINGS.users.enable}
              </button>
            </form>
          )}
          {!isSelf &&
            !user.disabled &&
            (confirming ? (
              <form action={toggleAction} className="flex items-center gap-2 text-xs">
                <button
                  type="submit"
                  disabled={togglePending}
                  className="text-danger underline underline-offset-2 disabled:opacity-50"
                >
                  {STRINGS.users.confirmDisable}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="underline underline-offset-2"
                >
                  {STRINGS.common.cancel}
                </button>
              </form>
            ) : (
              <button
                type="button"
                aria-label={STRINGS.users.disableAria(user.email)}
                onClick={() => setConfirming(true)}
                className="text-xs text-danger underline underline-offset-2"
              >
                {STRINGS.users.disable}
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
