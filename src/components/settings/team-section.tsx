"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Share2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { formatDate } from "@/lib/utils";
import {
  createInviteAction,
  getTeamAction,
  removeMemberAction,
  revokeInviteAction,
  setMemberPasswordAction,
} from "@/server/actions";
import type { Member, PendingInvite } from "@/server/data";

const ROLE_LABEL = { owner: "Owner", member: "Team member" } as const;

export function TeamSection() {
  const { me, notify } = useStore();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "owner">("member");
  const [link, setLink] = useState<{ email: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const result = await getTeamAction().catch(() => null);
    if (result?.ok) {
      setMembers(result.data.members);
      setInvites(result.data.invites);
    }
  }, []);

  useEffect(() => {
    // Load the team list once this section is shown.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const result = await createInviteAction({ email, role }).catch(() => null);
    setBusy(false);
    if (!result?.ok) {
      notify(result?.error ?? "Couldn't create the invite.", "error");
      return;
    }
    setLink({ email: result.data.invite.email, url: result.data.link });
    setEmail("");
    void load();
  }

  async function setPassword(member: Member) {
    const password = window.prompt(
      `New password for ${member.name} (at least 10 characters). They'll be signed out and use this to sign in.`
    );
    if (!password) return;
    const result = await setMemberPasswordAction(member.userId, password).catch(() => null);
    notify(result?.ok ? `Password updated for ${member.name}. Tell them the new password.` : (result?.error ?? "Couldn't update the password."), result?.ok ? "info" : "error");
  }

  async function remove(member: Member) {
    if (!window.confirm(`Remove ${member.name} (${member.email})? They'll lose access right away.`)) return;
    const result = await removeMemberAction(member.userId).catch(() => null);
    if (result?.ok) {
      notify(`${member.name} removed`);
      void load();
    } else notify(result?.error ?? "Couldn't remove them.", "error");
  }

  async function revoke(invite: PendingInvite) {
    const result = await revokeInviteAction(invite.id).catch(() => null);
    if (result?.ok) void load();
    else notify(result?.error ?? "Couldn't cancel the invite.", "error");
  }

  return (
    <section className="rounded-3xl border border-border bg-white/70 p-4 sm:p-6">
      <h2 className="font-display text-xl text-foreground">Team</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Everyone here sees and edits the same customers, estimates, invoices and schedule. Only Owners can
        change company settings and manage the team.
      </p>

      <ul className="mt-4 divide-y divide-border rounded-2xl border border-border">
        {members.map((m) => (
          <li key={m.userId} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-foreground">
                {m.name} {m.userId === me.id ? <span className="text-muted-foreground">(you)</span> : null}
              </p>
              <p className="text-sm text-muted-foreground">
                {m.email} · {ROLE_LABEL[m.role]}
              </p>
            </div>
            {m.userId !== me.id ? (
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="h-10 rounded-xl" onClick={() => setPassword(m)}>
                  Set password
                </Button>
                <Button type="button" variant="ghost" className="h-10 rounded-xl text-rose-700" onClick={() => remove(m)}>
                  Remove
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {invites.length ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-foreground">Waiting to join</h3>
          <ul className="mt-2 space-y-2">
            {invites.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 rounded-xl bg-muted/60 px-3 py-2 text-sm">
                <span>
                  {i.email} · {ROLE_LABEL[i.role]} · link expires {formatDate(i.expiresAt)}
                </span>
                <Button type="button" variant="ghost" className="h-9 rounded-lg" onClick={() => revoke(i)}>
                  Cancel
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <form onSubmit={invite} className="mt-5 grid gap-3 sm:grid-cols-[1fr_11rem_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="invite-email">Invite by email</Label>
          <Input
            id="invite-email"
            type="email"
            required
            className="h-11 rounded-xl"
            placeholder="crew@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="invite-role">Access</Label>
          <Select value={role} onValueChange={(v) => setRole((v as "member" | "owner") || "member")}>
            <SelectTrigger id="invite-role" className="h-11 rounded-xl">
              <SelectValue>{(v: "member" | "owner") => ROLE_LABEL[v]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Team member</SelectItem>
              <SelectItem value="owner">Owner</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={busy} className="h-11 rounded-xl bg-brand text-brand-foreground hover:bg-brand/90">
          <UserPlus className="size-4" />
          {busy ? "Creating…" : "Create invite"}
        </Button>
      </form>

      {link ? (
        <div className="mt-4 rounded-2xl border border-brand/30 bg-brand-muted p-3">
          <p className="text-sm text-foreground">
            Send this link to <strong>{link.email}</strong> by text or email. It works once and expires in 7
            days. It won&apos;t be shown again.
          </p>
          <Input readOnly value={link.url} className="mt-2 h-11 rounded-xl bg-white" onFocus={(e) => e.currentTarget.select()} />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link.url);
                  notify("Link copied");
                } catch {
                  notify("Couldn't copy. Select the link and copy it.", "error");
                }
              }}
            >
              <Copy className="size-4" />
              Copy link
            </Button>
            {typeof navigator !== "undefined" && "share" in navigator ? (
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl"
                onClick={() =>
                  navigator
                    .share({ title: "Join Bid Builder", text: `You're invited to ${me.companyName} on Bid Builder.`, url: link.url })
                    .catch(() => {})
                }
              >
                <Share2 className="size-4" />
                Share
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
