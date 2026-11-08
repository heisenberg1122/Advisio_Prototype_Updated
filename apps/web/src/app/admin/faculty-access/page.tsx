import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  AccountInvitations,
  InviteAccountDialog,
} from "@/components/system-admin/AccountInvitations";
import { Button } from "@/components/ui/Button";

export default function FacultyAccessPage() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <main className="workspace-page mx-auto flex w-full max-w-[1360px] flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header className="workspace-page-header flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Faculty access</h1>
          <p className="mt-2 text-[var(--color-text-secondary)]">
            Invite advisers and request professor or panelist access for{" "}
            {user?.college?.name || "your college"}.
          </p>
        </div>
        <Button data-guide="dean-faculty-access" disabled={!user?.college} onClick={() => setOpen(true)}>
          Invite or request access
        </Button>
      </header>
      {message && (
        <p
          role="status"
          className="rounded-xl bg-[var(--color-surface-muted)] p-4"
        >
          {message}
        </p>
      )}
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <AccountInvitations />
      </section>
      {open && (
        <InviteAccountDialog
          users={[]}
          colleges={user?.college ? [user.college] : []}
          onManageExisting={() => {}}
          onClose={() => setOpen(false)}
          onSent={(notice) => {
            setOpen(false);
            setMessage(notice);
          }}
        />
      )}
    </main>
  );
}
