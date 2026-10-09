import { useEffect, useMemo, useState } from "react";

type WorkflowParticipant = {
  id: string;
  workflowId?: string;
  joinedAt: string;
  user: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    universityId?: string | null;
    email: string;
  };
};

type WorkflowParticipantsCardProps = {
  workflowId?: string;
  workflowName?: string;
  participants: WorkflowParticipant[];
  isLoading?: boolean;
  error?: unknown;
  invitation?: { code: string; link: string } | null;
  invitationLoading?: boolean;
  onInvite: () => void;
  onRemove: (participant: WorkflowParticipant) => void;
};

function participantName(participant: WorkflowParticipant) {
  return `${participant.user.firstName || ""} ${participant.user.lastName || ""}`.trim() || participant.user.email;
}

function joinedDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function WorkflowParticipantsCard({
  workflowId,
  workflowName,
  participants,
  isLoading = false,
  error,
  invitation,
  invitationLoading = false,
  onInvite,
  onRemove,
}: WorkflowParticipantsCardProps) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<WorkflowParticipant | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");

  useEffect(() => {
    setSearch("");
    setSelected(null);
    setCopyStatus("idle");
  }, [workflowId]);

  const filteredParticipants = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return participants;
    return participants.filter((participant) =>
      [
        participantName(participant),
        participant.user.universityId,
        participant.user.email,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [participants, search]);

  const copyInvitation = async () => {
    if (!invitation) return;
    await navigator.clipboard.writeText(invitation.link);
    setCopyStatus("copied");
    window.setTimeout(() => setCopyStatus("idle"), 2000);
  };

  if (!workflowId) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <i className="ti ti-users-group text-3xl text-slate-300" />
        <h3 className="mt-3 font-extrabold text-[#102f49]">Select a workflow</h3>
        <p className="mt-1 text-sm text-slate-500">Select or create a workflow before managing its participants.</p>
      </section>
    );
  }

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5 lg:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-lg font-extrabold text-[#102f49]">Participants</h3>
              <p className="mt-1 text-sm text-slate-500">
                Researchers enrolled in <strong className="font-bold text-slate-700">{workflowName}</strong>.
              </p>
            </div>
            <button
              type="button"
              onClick={onInvite}
              disabled={invitationLoading}
              className="rounded-xl bg-[#173f63] px-4 py-2.5 text-sm font-extrabold text-white shadow-sm disabled:opacity-50"
            >
              <i className="ti ti-user-plus mr-1.5" />
              {invitationLoading ? "Preparing…" : invitation ? "Regenerate invitation" : "Invite researchers"}
            </button>
          </div>

          {invitation && (
            <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/70 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <label className="min-w-0 flex-1 text-xs font-bold uppercase tracking-wider text-blue-700">
                  Workflow invitation link
                  <input readOnly value={invitation.link} className="mt-1.5 w-full rounded-lg border border-blue-200 bg-white px-3 py-2.5 text-xs font-normal normal-case tracking-normal text-slate-700" />
                </label>
                <button type="button" onClick={() => void copyInvitation()} className="rounded-lg bg-[#173f63] px-4 py-2.5 text-xs font-bold text-white">
                  <i className={`ti ${copyStatus === "copied" ? "ti-check" : "ti-copy"} mr-1.5`} />
                  {copyStatus === "copied" ? "Copied" : "Copy link"}
                </button>
              </div>
              <p className="mt-2 text-xs text-blue-800">Code: <strong className="font-mono">{invitation.code}</strong> · Researchers who use this invitation join only {workflowName}.</p>
            </div>
          )}

          <div className="relative mt-5 max-w-md">
            <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, student number, or email"
              aria-label="Search workflow participants"
              className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#173f63] focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3 p-6" aria-label="Loading participants">
            {[0, 1, 2, 3].map((item) => <div key={item} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm font-semibold text-rose-700">The participants could not be loaded. Please try again.</div>
        ) : participants.length === 0 ? (
          <div className="p-10 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-blue-50 text-[#173f63]"><i className="ti ti-users-plus text-2xl" /></span>
            <h4 className="mt-3 font-extrabold text-[#102f49]">No researchers enrolled yet</h4>
            <p className="mt-1 text-sm text-slate-500">Share this workflow’s invitation link with the appropriate researchers.</p>
            <button type="button" onClick={onInvite} disabled={invitationLoading} className="mt-4 rounded-xl bg-[#173f63] px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-50">Invite researchers</button>
          </div>
        ) : filteredParticipants.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">No participants match “{search}”.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead className="bg-slate-50 text-xs font-extrabold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-6 py-3.5">Name</th>
                  <th className="px-6 py-3.5">Student number</th>
                  <th className="px-6 py-3.5">Email</th>
                  <th className="px-6 py-3.5">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredParticipants.map((participant) => (
                  <tr
                    key={participant.id}
                    tabIndex={0}
                    onClick={() => setSelected(participant)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelected(participant);
                      }
                    }}
                    className="cursor-pointer text-sm transition hover:bg-blue-50/50 focus:bg-blue-50/50 focus:outline-none"
                    aria-label={`View ${participantName(participant)}`}
                  >
                    <td className="px-6 py-4 font-extrabold text-[#102f49]">{participantName(participant)}</td>
                    <td className="px-6 py-4 font-semibold text-slate-600">{participant.user.universityId || "—"}</td>
                    <td className="px-6 py-4 text-slate-600">{participant.user.email}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-slate-500">{joinedDate(participant.joinedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/45 p-4" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}>
          <section role="dialog" aria-modal="true" aria-labelledby="participant-detail-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#C58A18]">Workflow participant</p>
                <h2 id="participant-detail-title" className="mt-1 text-xl font-extrabold text-[#102f49]">{participantName(selected)}</h2>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Close participant details" className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-500"><i className="ti ti-x" /></button>
            </div>
            <dl className="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-200 px-4">
              <div className="flex justify-between gap-4 py-3 text-sm"><dt className="text-slate-500">Student number</dt><dd className="font-bold text-slate-700">{selected.user.universityId || "—"}</dd></div>
              <div className="flex justify-between gap-4 py-3 text-sm"><dt className="text-slate-500">Email</dt><dd className="break-all text-right font-bold text-slate-700">{selected.user.email}</dd></div>
              <div className="flex justify-between gap-4 py-3 text-sm"><dt className="text-slate-500">Joined</dt><dd className="font-bold text-slate-700">{joinedDate(selected.joinedAt)}</dd></div>
            </dl>
            <div className="mt-6 flex justify-between gap-3">
              <button type="button" onClick={() => { onRemove(selected); setSelected(null); }} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-extrabold text-rose-700">Remove from workflow</button>
              <button type="button" onClick={() => setSelected(null)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-600">Close</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
