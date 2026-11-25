import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  AccountInvitations,
  InviteAccountDialog,
} from "@/components/system-admin/AccountInvitations";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { InlineFeedback } from "@/components/ui/advisio";
import { RoleBand, plural } from "@/components/dashboards/RoleScreenParts";

export default function FacultyAccessPage() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const invitations = useQuery({
    queryKey: ["account-invitations"],
    queryFn: () => apiClient.get<{ invitations: { status: string }[] }>("/api/account-invitations"),
  });
  const count = (status: string) => (invitations.data?.invitations || []).filter((item) => item.status === status).length;
  return (
    <main className="workspace-page rs mx-auto w-full max-w-[1360px] p-4 sm:p-6 lg:p-8">
      <RoleBand
        eyebrow="Research oversight"
        title="Faculty access"
        titleId="dean-faculty-title"
        meta={`${plural(count("AWAITING_APPROVAL"), "request is", "requests are")} awaiting approval · invite advisers or request professor and panelist access for ${user?.college?.name || "your college"}`}
        counts={[
          { label: "Awaiting approval", value: count("AWAITING_APPROVAL"), tone: count("AWAITING_APPROVAL") ? "waiting" : undefined },
          { label: "Invited", value: count("PENDING") },
          { label: "Accepted", value: count("ACCEPTED") },
        ]}
        countsLabel="Invitation summary"
        primary={{ label: "Invite or request access", phoneLabel: "Invite", icon: "ti-user-plus", guide: "de-faculty-invite", disabled: !user?.college, onClick: () => setOpen(true) }}
        secondary={[{ label: "Refresh", icon: "ti-refresh", onClick: () => void invitations.refetch() }]}
      />
      {message && <InlineFeedback tone="ok">{message}</InlineFeedback>}
      <AccountInvitations presentation="role" />
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
