"use client";

import { useEffect } from "react";

const invitationStatus: Record<
  string,
  { label: string; tone: string; icon: string }
> = {
  PENDING: {
    label: "Pending response",
    tone: "bg-amber-100 text-amber-800",
    icon: "ti-clock",
  },
  ACCEPTED: {
    label: "Accepted",
    tone: "bg-emerald-100 text-emerald-800",
    icon: "ti-circle-check",
  },
  DECLINED: {
    label: "Declined",
    tone: "bg-rose-100 text-rose-800",
    icon: "ti-circle-x",
  },
  RECONFIRMATION_REQUIRED: {
    label: "Reconfirmation required",
    tone: "bg-blue-100 text-blue-800",
    icon: "ti-refresh-alert",
  },
  REMOVED: {
    label: "Removed",
    tone: "bg-slate-200 text-slate-700",
    icon: "ti-user-minus",
  },
};

const sessionStatus: Record<string, { label: string; tone: string }> = {
  PENDING_ACKNOWLEDGEMENT: {
    label: "Awaiting panel responses",
    tone: "bg-amber-100 text-amber-800",
  },
  NEEDS_RESCHEDULING: {
    label: "Needs rescheduling",
    tone: "bg-rose-100 text-rose-800",
  },
  SCHEDULED: {
    label: "Confirmed",
    tone: "bg-emerald-100 text-emerald-800",
  },
  LIVE: { label: "In progress", tone: "bg-blue-100 text-blue-800" },
  DELIBERATION: {
    label: "Deliberation",
    tone: "bg-violet-100 text-violet-800",
  },
  COMPLETED: {
    label: "Completed",
    tone: "bg-emerald-100 text-emerald-800",
  },
  CANCELLED: {
    label: "Cancelled",
    tone: "bg-slate-200 text-slate-700",
  },
};

const fullName = (user: any) =>
  [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Unknown user";

const titleCase = (value = "") =>
  value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

function PersonCard({ member }: { member: any }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-50 text-xs font-extrabold text-[#173f63]">
        {member.user?.firstName?.[0] || "?"}
        {member.user?.lastName?.[0] || ""}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-extrabold text-[#102f49]">
          {fullName(member.user)}
        </p>
        <p className="truncate text-xs text-slate-500">{member.user?.email}</p>
        <span className="mt-1.5 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
          {titleCase(member.projectRole)}
        </span>
      </div>
    </div>
  );
}

export function DefenseSessionStatusModal({
  session,
  event,
  onClose,
}: {
  session: any;
  event?: any;
  onClose: () => void;
}) {
  useEffect(() => {
    const closeOnEscape = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const members = session.research?.members || [];
  const researchers = members.filter((member: any) =>
    ["LEADER", "MEMBER"].includes(member.projectRole),
  );
  const memberAdvisers = members.filter(
    (member: any) => member.projectRole === "ADVISER",
  );
  const requestAdvisers = (session.research?.adviserRequests || []).map(
    (request: any) => ({
      id: `request-${request.id}`,
      projectRole: "ADVISER",
      user: request.adviser,
    }),
  );
  const advisers = Array.from(
    new Map(
      [...memberAdvisers, ...requestAdvisers].map((member: any) => [
        member.user?.id || member.id,
        member,
      ]),
    ).values(),
  );
  const invitations = (session.invitations || []).filter(
    (invitation: any) => invitation.status !== "REMOVED",
  );
  const acceptedCount = invitations.filter(
    (invitation: any) => invitation.status === "ACCEPTED",
  ).length;
  const pendingCount = invitations.filter((invitation: any) =>
    ["PENDING", "RECONFIRMATION_REQUIRED"].includes(invitation.status),
  ).length;
  const declinedCount = invitations.filter(
    (invitation: any) => invitation.status === "DECLINED",
  ).length;
  const currentSessionStatus = sessionStatus[session.status] || {
    label: titleCase(session.status),
    tone: "bg-slate-100 text-slate-700",
  };

  return (
    <div
      className="fixed inset-0 z-[110] grid place-items-center bg-slate-950/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="defense-session-status-title"
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.target === mouseEvent.currentTarget) onClose();
      }}
    >
      <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white p-5">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#d98d00]">
              Defense session status
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2
                id="defense-session-status-title"
                className="text-xl font-black text-[#102f49]"
              >
                {session.research?.title || "Research group"}
              </h2>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${currentSessionStatus.tone}`}
              >
                {currentSessionStatus.label}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {event?.code ? `${event.code} · ` : ""}
              Queue {session.queuePosition || 1}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close defense session status"
            className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-[#173f63]"
          >
            <i className="ti ti-x text-lg" />
          </button>
        </header>

        <div className="space-y-5 p-5">
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Schedule
              </p>
              <p className="mt-1 text-sm font-bold text-[#102f49]">
                {session.scheduledStart
                  ? new Date(session.scheduledStart).toLocaleString()
                  : "Not scheduled"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Venue
              </p>
              <p className="mt-1 text-sm font-bold text-[#102f49]">
                {session.venue || (session.meetingUrl ? "Online defense" : "Not set")}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                Accepted
              </p>
              <p className="mt-1 text-xl font-extrabold text-emerald-800">
                {acceptedCount}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-[10px] font-bold uppercase text-amber-700">Pending</p>
                <p className="mt-1 text-xl font-extrabold text-amber-800">{pendingCount}</p>
              </div>
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                <p className="text-[10px] font-bold uppercase text-rose-700">Declined</p>
                <p className="mt-1 text-xl font-extrabold text-rose-800">{declinedCount}</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-[#102f49]">Defense panel</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Invitation roles and current responses for this session.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                {acceptedCount}/{invitations.length} accepted
              </span>
            </div>
            {invitations.length ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {invitations.map((invitation: any) => {
                  const status = invitationStatus[invitation.status] || {
                    label: titleCase(invitation.status),
                    tone: "bg-slate-100 text-slate-700",
                    icon: "ti-help-circle",
                  };
                  return (
                    <article
                      key={invitation.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-extrabold text-[#102f49]">
                            {fullName(invitation.invitee)}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {invitation.invitee?.email}
                          </p>
                          <p className="mt-1 text-[10px] font-extrabold uppercase tracking-wider text-[#173f63]">
                            {titleCase(invitation.role)}
                            {invitation.isRequired === false ? " · Optional" : " · Required"}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-extrabold ${status.tone}`}
                        >
                          <i className={`ti ${status.icon} mr-1`} />
                          {status.label}
                        </span>
                      </div>
                      {invitation.respondedAt && (
                        <p className="mt-2 text-[10px] text-slate-400">
                          Responded {new Date(invitation.respondedAt).toLocaleString()}
                        </p>
                      )}
                      {invitation.responseNote && (
                        <p className="mt-2 rounded-lg bg-white p-2 text-xs text-slate-600">
                          <strong>Response:</strong> {invitation.responseNote}
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                No panel participants are assigned to this session.
              </p>
            )}
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-[#102f49]">Researchers</h3>
                <span className="text-xs font-bold text-slate-500">
                  {researchers.length}
                </span>
              </div>
              {researchers.length ? (
                <div className="mt-3 space-y-2">
                  {researchers.map((member: any) => (
                    <PersonCard key={member.id} member={member} />
                  ))}
                </div>
              ) : (
                <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                  No active researchers are assigned.
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-[#102f49]">Advisers</h3>
                <span className="text-xs font-bold text-slate-500">
                  {advisers.length}
                </span>
              </div>
              {advisers.length ? (
                <div className="mt-3 space-y-2">
                  {advisers.map((member: any) => (
                    <PersonCard key={member.id} member={member} />
                  ))}
                </div>
              ) : (
                <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                  This research group has no active adviser assigned.
                </p>
              )}
            </section>
          </div>
        </div>

        <footer className="sticky bottom-0 flex justify-end border-t border-slate-200 bg-white p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[#173f63] px-5 py-2.5 text-sm font-extrabold text-white"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
